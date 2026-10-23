# SAGE — AI Deepfake Video Detection System

SAGE is a dual-branch neural deepfake video detector combining semantic feature extraction (DINOv2) and forensic artifact detection (Bayar constrained convolution) with a Next.js web interface and Flask backend.

---

## Prerequisites

- **Python:** 3.10 to 3.12 (with `pip`)
- **Node.js:** 18+ (with `npm`)
- **Model Checkpoint:** Ensure `bayar.pth` is placed inside `backend/`.

---

## 1. Backend Setup (Flask + PyTorch)

Open a terminal and navigate to the `backend` folder:

```bash
cd backend
```

### Create and activate virtual environment

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Run the backend server

```bash
python app.py
```
> The API will start on `http://127.0.0.1:5000`. Keep this terminal open.

---

## 2. Frontend Setup (Next.js)

Open a **new** terminal window and navigate to `frontend`:

```bash
cd frontend
```

### Install packages & run development server

```bash
npm install
npm run dev
```

> Open [http://localhost:3000](http://localhost:3000) in your browser.  
> Go to **Detect Studio** (`http://localhost:3000/detect`) to analyze videos.

---

## 3. Quick Verification

To verify that the model checkpoint, preprocessing pipeline, and API endpoints are working properly, run the test suite from `backend`:

```bash
cd backend
python test_suite.py
```

---

## Video Upload Requirements

- **Supported Formats:** MP4, MOV, WebM, AVI, MKV
- **Max File Size:** 100 MB
- **Face Requirement:** Video must contain at least one clearly visible human face (SAGE extracts 30 facial frames using MTCNN for forensic analysis).