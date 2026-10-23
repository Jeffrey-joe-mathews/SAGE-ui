"""
Video preprocessing and MTCNN facial extraction pipeline for SAGE.
Extracts 30 temporally sampled frames from input video, crops faces to 224x224,
and outputs normalized [1, 30, 3, 224, 224] tensors matching the SAGE training pipeline.
"""

import base64
from typing import Any, Dict, List, Optional, Tuple, Union
import cv2
import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN, extract_face

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


def _tensor_to_jpeg_base64(face_norm: torch.Tensor) -> str:
    """Convert [3, 224, 224] normalized tensor [0, 1] to base64 JPEG thumbnail."""
    img_np = (face_norm.permute(1, 2, 0).cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    thumb = cv2.resize(img_np, (80, 80), interpolation=cv2.INTER_AREA)
    thumb_bgr = cv2.cvtColor(thumb, cv2.COLOR_RGB2BGR)
    _, buf = cv2.imencode(".jpg", thumb_bgr, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return f"data:image/jpeg;base64,{base64.b64encode(buf).decode('ascii')}"


def preprocess_video(
    video_path: str, return_metadata: bool = False
) -> Union[torch.Tensor, Tuple[torch.Tensor, Dict[str, Any]]]:
    """
    Extract, detect faces, and preprocess a video for SAGE inference.

    Args:
        video_path: Path to the video file on disk.
        return_metadata: If True, returns (tensor, metadata_dict) where metadata
                         includes thumbnails, face detection confidence, and video metrics.

    Returns:
        torch.Tensor of shape [1, 30, 3, 224, 224] with dtype float32,
        normalized to [0.0, 1.0], or a tuple of (tensor, metadata).

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
        video_fps = float(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

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
        detections: List[Dict[str, Any]] = []
        faces_detected_count = 0
        first_valid_face: Optional[torch.Tensor] = None
        last_valid_face: Optional[torch.Tensor] = None

        # Scaling factor for ultra-fast face detection (max 640px dimension)
        scale = 640.0 / max(width, height) if max(width, height) > 640 else 1.0

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

            # Detect and extract face in single pass
            face = None
            box_info = None
            conf_val = 0.99

            if scale < 1.0:
                small_w = int(width * scale)
                small_h = int(height * scale)
                small_frame = cv2.resize(frame, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
                rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                boxes, probs = face_detector.detect(Image.fromarray(rgb_small))
                if boxes is not None and len(boxes) > 0:
                    best_idx = int(np.argmax(probs))
                    orig_box = boxes[best_idx] / scale
                    rgb_orig = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    face = extract_face(Image.fromarray(rgb_orig), orig_box, image_size=IMAGE_SIZE, margin=0)
                    box_info = [round(float(x), 1) for x in orig_box]
                    conf_val = float(probs[best_idx])
            else:
                rgb_orig = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_orig = Image.fromarray(rgb_orig)
                boxes, probs = face_detector.detect(pil_orig)
                if boxes is not None and len(boxes) > 0:
                    best_idx = int(np.argmax(probs))
                    face = extract_face(pil_orig, boxes[best_idx], image_size=IMAGE_SIZE, margin=0)
                    box_info = [round(float(x), 1) for x in boxes[best_idx]]
                    conf_val = float(probs[best_idx])

            if face is not None:
                # extract_face returns [3, 224, 224] float32 tensor with pixel values in [0.0, 255.0]
                # Normalizing by 255.0 brings values into [0.0, 1.0], matching transforms.ToTensor()
                normalized_face = face.float() / 255.0
                raw_frames.append(normalized_face)
                faces_detected_count += 1
                last_valid_face = normalized_face
                if first_valid_face is None:
                    first_valid_face = normalized_face

                detections.append({
                    "detected": True,
                    "confidence": round(conf_val, 4),
                    "box": box_info,
                    "frame_index": int(index),
                })
            else:
                # Temporal forward-fill tracking if a face was previously detected
                detections.append({
                    "detected": False,
                    "confidence": None,
                    "box": None,
                    "frame_index": int(index),
                })
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
        batch_tensor = frames_tensor.unsqueeze(0)

        if not return_metadata:
            return batch_tensor

        # Generate base64 thumbnails for each of the 30 analyzed faces
        thumbnails = [_tensor_to_jpeg_base64(f) for f in processed_frames]

        metadata = {
            "frames_extracted": NUM_FRAMES,
            "faces_detected_count": faces_detected_count,
            "frame_thumbnails": thumbnails,
            "face_detections": detections,
            "video_fps": round(video_fps, 2) if video_fps > 0 else 30.0,
            "video_resolution": f"{width}x{height}",
            "total_video_frames": total_frames,
        }

        return batch_tensor, metadata

    finally:
        cap.release()

