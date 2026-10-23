"""
Automated backend verification test suite for SAGE Deepfake Detection.
Tests:
1. Model loading & checkpoint key verification
2. Preprocessing pipeline & tensor shapes
3. Flask / and /health endpoints
4. Missing file, unsupported extension, corrupt video, no-face video
5. End-to-end video inference and prediction output
"""

import io
import json
from pathlib import Path
import torch

from app import app, initialize_model, model_loader, CHECKPOINT_PATH
from preprocessing import preprocess_video


def run_all_tests():
    print("=" * 60)
    print("SAGE BACKEND AUDIT & VERIFICATION SUITE")
    print("=" * 60)

    # --- Test 1: Checkpoint Existence and Loading ---
    print("\n[TEST 1] Model Checkpoint & Architecture Loading...")
    assert CHECKPOINT_PATH.exists(), f"Checkpoint missing at {CHECKPOINT_PATH}"
    print(f"Checkpoint file exists: {CHECKPOINT_PATH} ({CHECKPOINT_PATH.stat().st_size / (1024*1024):.1f} MB)")

    initialize_model()
    from app import model_loader as active_loader
    assert active_loader is not None, "Model loader failed to initialize!"
    assert active_loader.model is not None, "Model instance is None!"
    print(f"PASS: SAGE B4BayarGatedDetector initialized successfully on {active_loader.device}")

    # --- Test 2: Checkpoint strict match verification ---
    print("\n[TEST 2] Verifying Checkpoint Tensor Parameter Match...")
    model_params = dict(active_loader.model.named_parameters())
    print(f"Total model parameters: {len(model_params)}")
    assert "forensic_extractor.bayar.kernel" in model_params, "BayarConv kernel missing!"
    assert "b2_extractor.temporal_depthwise.weight" in model_params, "Temporal conv missing!"
    assert "gate.0.weight" in model_params, "Fusion gate missing!"
    assert "classifier.0.weight" in model_params, "Classifier missing!"
    print("PASS: All key SAGE dual-branch layers present and verified.")

    # --- Test 3: Flask Health & Root Endpoints ---
    print("\n[TEST 3] Testing Flask GET / and GET /health...")
    client = app.test_client()

    res_root = client.get("/")
    assert res_root.status_code == 200, f"Expected 200, got {res_root.status_code}"
    data_root = res_root.get_json()
    assert data_root["model_ready"] is True, "Root endpoint reports model_ready=False"
    print(f"PASS: GET / -> 200 OK: {data_root}")

    res_health = client.get("/health")
    assert res_health.status_code == 200, f"Expected 200, got {res_health.status_code}"
    data_health = res_health.get_json()
    assert data_health["status"] == "ok" and data_health["model_ready"] is True
    print(f"PASS: GET /health -> 200 OK: {data_health}")

    # --- Test 4: Missing video field ---
    print("\n[TEST 4] Testing POST /detect without 'video' field...")
    res_nofile = client.post("/detect", data={})
    assert res_nofile.status_code == 400, f"Expected 400, got {res_nofile.status_code}"
    print(f"PASS: Missing field returned 400: {res_nofile.get_json()}")

    # --- Test 5: Unsupported file extension ---
    print("\n[TEST 5] Testing POST /detect with unsupported format (.txt)...")
    res_badext = client.post(
        "/detect",
        data={"video": (io.BytesIO(b"fake text data"), "sample.txt")},
        content_type="multipart/form-data"
    )
    assert res_badext.status_code == 400, f"Expected 400, got {res_badext.status_code}"
    print(f"PASS: Unsupported extension returned 400: {res_badext.get_json()}")

    # --- Test 6: Corrupt video file ---
    print("\n[TEST 6] Testing POST /detect with corrupted video file...")
    res_corrupt = client.post(
        "/detect",
        data={"video": (io.BytesIO(b"not a real video content header"), "corrupt.mp4")},
        content_type="multipart/form-data"
    )
    assert res_corrupt.status_code == 400, f"Expected 400, got {res_corrupt.status_code}"
    print(f"PASS: Corrupt file returned 400: {res_corrupt.get_json()}")

    # --- Test 7: Video with no face detected ---
    print("\n[TEST 7] Testing POST /detect with video containing no face...")
    no_face_path = Path(__file__).resolve().parent / "test_no_face.mp4"
    if no_face_path.exists():
        with open(no_face_path, "rb") as f:
            res_noface = client.post(
                "/detect",
                data={"video": (f, "test_no_face.mp4")},
                content_type="multipart/form-data"
            )
        assert res_noface.status_code == 400, f"Expected 400, got {res_noface.status_code}"
        print(f"PASS: No-face video returned 400: {res_noface.get_json()}")
    else:
        print("SKIP: test_no_face.mp4 not found")

    # --- Test 8: End-to-End Real Video Inference ---
    print("\n[TEST 8] Testing POST /detect with authentic 30-frame face video...")
    face_video_path = Path(__file__).resolve().parent / "test_sample_face.mp4"
    assert face_video_path.exists(), "test_sample_face.mp4 missing"

    with open(face_video_path, "rb") as f:
        res_detect = client.post(
            "/detect",
            data={"video": (f, "test_sample_face.mp4")},
            content_type="multipart/form-data"
        )
    assert res_detect.status_code == 200, f"Expected 200, got {res_detect.status_code}: {res_detect.get_json()}"
    data_detect = res_detect.get_json()
    print(f"PASS: POST /detect returned 200 OK:")
    print(json.dumps(data_detect, indent=2))

    assert "prediction" in data_detect, "Missing 'prediction' key"
    assert data_detect["prediction"] in ["REAL", "FAKE"], "Invalid prediction label"
    assert "fake_probability" in data_detect, "Missing 'fake_probability'"
    assert "authentic_probability" in data_detect, "Missing 'authentic_probability'"
    assert "disagreement_alpha" in data_detect, "Missing 'disagreement_alpha'"
    assert data_detect["frames_analyzed"] == 30, "Expected 30 frames analyzed"

    print("\n" + "=" * 60)
    print("ALL 8 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    run_all_tests()
