"""
SAGE Deepfake Video Detection Flask REST API.
Provides endpoints for health checking and genuine neural forensic video inference.
"""

import os
import tempfile
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from preprocessing import preprocess_video
from sage_model import SAGEModelLoader

app = Flask(__name__)

# Allow frontend requests from Next.js dev and production servers
CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
        }
    },
)

# Upload size limit: 100 MB
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024

BASE_DIR = Path(__file__).resolve().parent
CHECKPOINT_PATH = BASE_DIR / "bayar.pth"

model_loader = None


def initialize_model():
    """Load SAGE checkpoint on application startup."""
    global model_loader

    if not CHECKPOINT_PATH.exists():
        app.logger.error(f"Checkpoint not found at: {CHECKPOINT_PATH}")
        return

    try:
        app.logger.info(f"Loading SAGE checkpoint from {CHECKPOINT_PATH}...")
        model_loader = SAGEModelLoader(str(CHECKPOINT_PATH))
        app.logger.info(
            f"SAGE model successfully loaded on device: {model_loader.device}"
        )
    except Exception as exc:
        app.logger.exception(f"Failed to initialize SAGE model: {exc}")


@app.get("/")
def home():
    """Root info endpoint."""
    return jsonify({
        "project": "SAGE",
        "message": "Deepfake Detection API",
        "model_ready": model_loader is not None,
        "device": str(model_loader.device) if model_loader else None,
        "architecture": "B4BayarGatedDetector (DINOv2-small + BayarConv2d)",
    })


@app.get("/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "model_ready": model_loader is not None,
        "device": str(model_loader.device) if model_loader else None,
        "checkpoint": str(CHECKPOINT_PATH.name)
        if CHECKPOINT_PATH.exists()
        else None,
    })


@app.post("/detect")
def detect_video():
    """
    Video deepfake detection endpoint.
    Accepts multipart/form-data video upload with field name 'video'.
    """
    if model_loader is None:
        return jsonify({
            "error": "SAGE model is not loaded yet. Check server logs."
        }), 503

    if "video" not in request.files:
        return jsonify({
            "error": "Upload a video using the 'video' field in multipart/form-data."
        }), 400

    uploaded_file = request.files["video"]

    if not uploaded_file.filename:
        return jsonify({"error": "No video file selected."}), 400

    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    extension = Path(uploaded_file.filename).suffix.lower()

    if extension not in allowed_extensions:
        return jsonify({
            "error": f"Unsupported format '{extension}'. Supported formats: MP4, AVI, MOV, MKV, WebM."
        }), 400

    temp_path = None

    try:
        # Securely save uploaded video to temporary file
        with tempfile.NamedTemporaryFile(
            suffix=extension, delete=False
        ) as temp_file:
            temp_path = temp_file.name
            uploaded_file.save(temp_path)

        # Preprocess video into [1, 30, 3, 224, 224] tensor
        video_tensor = preprocess_video(temp_path)

        # Run forward inference through dual-branch SAGE architecture
        result = model_loader.predict(video_tensor)

        # Calculate user-friendly confidence
        fake_prob = result["fake_probability"]
        auth_prob = result["authentic_probability"]
        confidence_val = max(fake_prob, auth_prob)

        return jsonify({
            "status": "success",
            "prediction": result["prediction"],
            "fake_probability": round(fake_prob, 4),
            "authentic_probability": round(auth_prob, 4),
            "confidence": f"{confidence_val * 100:.1f}%",
            "logit": round(result["logit"], 4),
            "disagreement_alpha": round(result["disagreement_alpha"], 4),
            "frames_analyzed": 30,
            "device": result["device"],
        })

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    except Exception as exc:
        app.logger.exception("Video analysis failed")
        return jsonify({
            "error": f"Video analysis failed: {str(exc)}"
        }), 500

    finally:
        # Ensure temporary video file is deleted
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error": "Video exceeds the 100 MB upload limit."
    }), 413


if __name__ == "__main__":
    initialize_model()
    app.run(host="127.0.0.1", port=5000, debug=False)
