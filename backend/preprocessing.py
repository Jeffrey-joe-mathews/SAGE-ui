
import cv2
import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN
from torchvision import transforms

NUM_FRAMES = 30
IMAGE_SIZE = 224

face_detector = MTCNN(
    image_size=IMAGE_SIZE,
    margin=0,
    keep_all=False,
    post_process=False,
    device="cuda" if torch.cuda.is_available() else "cpu",
)

image_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
])


def preprocess_video(video_path: str) -> torch.Tensor:
    """Return a tensor shaped [1, 30, 3, 224, 224]."""

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise ValueError("Could not open the uploaded video.")

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        if total_frames <= 0:
            raise ValueError("The video contains no readable frames.")

        frame_indices = np.linspace(
            0, total_frames - 1, NUM_FRAMES, dtype=int
        )

        processed_frames = []

        for index in frame_indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(index))
            success, frame = cap.read()

            if not success:
                raise ValueError(f"Could not read frame {index}.")

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb)

            face = face_detector(pil_image)

            if face is None:
                raise ValueError(
                    f"No face detected in sampled frame {index}."
                )

            # MTCNN returns a [3, H, W] tensor here.
            face_image = transforms.ToPILImage()(face)
            processed_frames.append(image_transform(face_image))

        # [30, 3, 224, 224]
        frames_tensor = torch.stack(processed_frames)

        # [1, 30, 3, 224, 224]
        return frames_tensor.unsqueeze(0)

    finally:
        cap.release()
