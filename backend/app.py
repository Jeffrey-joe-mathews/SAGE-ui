
import os
import tempfile
from pathlib import Path

import torch
from flask import Flask, jsonify, request
from flask_cors import CORS

from preprocessing import preprocess_video
from sage_model import SAGEModelLoader

app = Flask(__name__)
CORS(app, resources={
    r"/*": {"origins": [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]}
})

app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB

BASE_DIR = Path(__file__).resolve().parent
CHECKPOINT_PATH = BASE_DIR / "bayar.pth"

model_loader = None


def initialize_model():
    global model_loader

    if not CHECKPOINT_PATH.exists():
        print(f"Checkpoint not found: {CHECKPOINT_PATH}")
        return

    try:
        model_loader = SAGEModelLoader(str(CHECKPOINT_PATH))
    except NotImplementedError as exc:
        print(f"Model integration is not complete: {exc}")


@app.get("/")
def home():
    return jsonify({
        "project": "SAGE",
        "message": "Deepfake Detection API",
        "model_ready": model_loader is not None,
    })


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_ready": model_loader is not None,
    })


@app.post("/detect")
def detect_video():
    if model_loader is None:
        return jsonify({
            "error": "SAGE model is not loaded yet."
        }), 503

    if "video" not in request.files:
        return jsonify({
            "error": "Upload a video using the 'video' field."
        }), 400

    uploaded_file = request.files["video"]

    if not uploaded_file.filename:
        return jsonify({"error": "No video selected."}), 400

    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv"}
    extension = Path(uploaded_file.filename).suffix.lower()

    if extension not in allowed_extensions:
        return jsonify({
            "error": "Supported formats: MP4, AVI, MOV, MKV."
        }), 400

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=extension, delete=False
        ) as temp_file:
            temp_path = temp_file.name
            uploaded_file.save(temp_path)

        # Preprocess video into model input tensor.
        video_tensor = preprocess_video(temp_path)
        video_tensor = video_tensor.to(model_loader.device)

        # This assumes the completed loader exposes .model.
        model = model_loader.model
        model.eval()

        with torch.inference_mode():
            output = model(video_tensor)

        # Confirm the model's output and class-label convention
        # from SAGE.ipynb before using this calculation.
        logit = output.reshape(-1)[0]
        fake_probability = torch.sigmoid(logit).item()

        prediction = (
            "FAKE" if fake_probability >= 0.5 else "REAL"
        )

        return jsonify({
            "prediction": prediction,
            "fake_probability": round(fake_probability, 4),
            "authentic_probability": round(
                1.0 - fake_probability, 4
            ),
        })

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    except Exception:
        app.logger.exception("Video analysis failed")
        return jsonify({
            "error": "Video analysis failed. Check backend logs."
        }), 500

    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error": "Video exceeds the 100 MB upload limit."
    }), 413


if __name__ == "__main__":
    initialize_model()
    app.run(host="127.0.0.1", port=5000, debug=False)
