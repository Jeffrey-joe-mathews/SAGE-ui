"""
Video preprocessing and MTCNN facial extraction pipeline for SAGE.
Extracts 30 temporally sampled frames from input video, crops faces to 224x224,
and outputs normalized [1, 30, 3, 224, 224] tensors matching the SAGE training pipeline.
"""

from typing import List, Optional
import cv2
import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN

NUM_FRAMES = 30
IMAGE_SIZE = 224

# Initialize MTCNN on CUDA if available, else CPU
_device = "cuda" if torch.cuda.is_available() else "cpu"
face_detector = MTCNN(
    image_size=IMAGE_SIZE,
    margin=0,
    keep_all=False,
    post_process=False,
    device=_device,
)


def preprocess_video(video_path: str) -> torch.Tensor:
    """
    Extract, detect faces, and preprocess a video for SAGE inference.

    Args:
        video_path: Path to the video file on disk.

    Returns:
        torch.Tensor of shape [1, 30, 3, 224, 224] with dtype float32,
        normalized to [0.0, 1.0].

    Raises:
        ValueError: If video cannot be opened, has no readable frames,
                    or contains no detectable human faces.
    """
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise ValueError(
            "Could not open the uploaded video file. "
            "Please ensure it is an uncorrupted MP4, AVI, MOV, or MKV file."
        )

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            raise ValueError("The video contains no readable frames.")

        if total_frames < 5:
            raise ValueError(
                f"Video is too short ({total_frames} frames). "
                "SAGE requires at least 5 frames for forensic analysis."
            )

        # Evenly sample 30 frame indices across the full video duration
        frame_indices = np.linspace(
            0, total_frames - 1, NUM_FRAMES, dtype=int
        )

        raw_frames: List[Optional[torch.Tensor]] = []
        faces_detected_count = 0
        first_valid_face: Optional[torch.Tensor] = None
        last_valid_face: Optional[torch.Tensor] = None

        for index in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(index))
            success, frame = cap.read()

            if not success:
                # Fallback: sequential read if seek failed
                success, frame = cap.read()

            if not success:
                raise ValueError(
                    f"Could not read frame at index {index} from video."
                )

            # Convert OpenCV BGR to RGB
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb)

            # Detect & crop face with MTCNN (post_process=False returns float32 in [0, 255])
            face = face_detector(pil_image)

            if face is not None:
                # MTCNN returns [3, 224, 224] float32 tensor with pixel values in [0.0, 255.0]
                # Normalizing by 255.0 brings values into [0.0, 1.0], matching transforms.ToTensor()
                normalized_face = face.float() / 255.0
                raw_frames.append(normalized_face)
                faces_detected_count += 1
                last_valid_face = normalized_face
                if first_valid_face is None:
                    first_valid_face = normalized_face
            else:
                # Temporal forward-fill tracking if a face was previously detected
                if last_valid_face is not None:
                    raw_frames.append(last_valid_face)
                else:
                    raw_frames.append(None)

        if faces_detected_count == 0:
            raise ValueError(
                "No human face detected in the uploaded video. "
                "SAGE requires a clear face sequence for deepfake forensic detection."
            )

        # Minimum face visibility requirement
        if faces_detected_count < 3:
            raise ValueError(
                f"Insufficient face tracking: only {faces_detected_count} of {NUM_FRAMES} "
                "sampled frames contained a detectable face. Ensure the face is visible."
            )

        # Backward-fill any leading frames where detection was missing before first face
        processed_frames: List[torch.Tensor] = []
        for f in raw_frames:
            if f is None:
                processed_frames.append(first_valid_face)
            else:
                processed_frames.append(f)

        # Stack into [30, 3, 224, 224]
        frames_tensor = torch.stack(processed_frames)

        # Add batch dimension -> [1, 30, 3, 224, 224]
        return frames_tensor.unsqueeze(0)

    finally:
        cap.release()
