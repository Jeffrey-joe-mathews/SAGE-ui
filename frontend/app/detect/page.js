"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

const API_BASE = "http://127.0.0.1:5000";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB, matches Flask backend limit
const ALLOWED_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv", ".webm"];

export default function DetectStudio() {
  // Backend health status: "checking" | "online" | "offline" | "not_ready"
  const [backendHealth, setBackendHealth] = useState("checking");
  const [backendInfo, setBackendInfo] = useState(null);

  // Video file & preview state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [activePresetObj, setActivePresetObj] = useState(null);
  const [playerViewMode, setPlayerViewMode] = useState("video"); // "video" | "crop"

  // Inference execution state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef(null);
  const videoElementRef = useRef(null);

  // 30 video frames array
  const filmFrames = Array.from({ length: 30 }, (_, i) => i);

  // Verified benchmark demo samples with real video files in /samples/
  const demoSamples = [
    {
      id: "real_interview",
      name: "Authentic Face Sequence",
      filename: "sample_real_face.mp4",
      url: "/samples/sample_real_face.mp4",
      groundTruth: "REAL",
      badgeColor: styles.sampleTagGreen,
      details: "30-frame genuine actor video (30 FPS • 1024x1024)",
    },
    {
      id: "deepfake_swap",
      name: "Manipulated Deepfake Sequence",
      filename: "sample_deepfake_face.mp4",
      url: "/samples/sample_deepfake_face.mp4",
      groundTruth: "FAKE",
      badgeColor: styles.sampleTagRed,
      details: "30-frame video with high-frequency boundary artifacts",
    },
    {
      id: "no_face_validation",
      name: "No-Face Edge Case",
      filename: "sample_no_face.mp4",
      url: "/samples/sample_no_face.mp4",
      groundTruth: "NO FACE",
      badgeColor: styles.sampleTagRed,
      details: "30-frame validation video with zero human faces",
    },
  ];

  // Check Flask backend health on mount
  const checkHealth = useCallback(async () => {
    setBackendHealth("checking");
    try {
      const res = await fetch(`${API_BASE}/health`, { method: "GET" });
      if (!res.ok) {
        setBackendHealth("offline");
        return;
      }
      const data = await res.json();
      if (data.model_ready) {
        setBackendHealth("online");
        setBackendInfo(data);
      } else {
        setBackendHealth("not_ready");
      }
    } catch {
      setBackendHealth("offline");
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // File validation
  const validateFile = (file) => {
    if (!file) return "No file selected.";
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported format '${ext}'. SAGE accepts MP4, AVI, MOV, MKV, or WebM.`;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return `File size (${sizeMB} MB) exceeds the 100 MB limit.`;
    }
    return null;
  };

  // Handle uploaded video file
  const handleFileUpload = (file) => {
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setUploadedFile(file);
    setActivePreset(null);
    setActivePresetObj(null);
    setAnalysisResult(null);
    setErrorMessage("");
    setActiveFrameIndex(0);
    setPlayerViewMode("video");

    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);
  };

  // Remove/clear currently selected video
  const removeSelectedVideo = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setUploadedFile(null);
    setVideoPreviewUrl(null);
    setActivePreset(null);
    setActivePresetObj(null);
    setAnalysisResult(null);
    setErrorMessage("");
    setActiveFrameIndex(0);
    setPlayerViewMode("video");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Drag-and-drop event handlers
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Select a verified demo sample video and load its genuine file
  const selectDemoSample = async (sample) => {
    if (isAnalyzing) return;

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setActivePreset(sample.id);
    setActivePresetObj(sample);
    setAnalysisResult(null);
    setErrorMessage("");
    setActiveFrameIndex(0);
    setPlayerViewMode("video");

    try {
      const res = await fetch(sample.url);
      if (!res.ok) {
        throw new Error(`Could not load sample video file (${res.status})`);
      }
      const blob = await res.blob();
      const file = new File([blob], sample.filename, { type: "video/mp4" });
      setUploadedFile(file);
      const objectUrl = URL.createObjectURL(blob);
      setVideoPreviewUrl(objectUrl);
    } catch (err) {
      setErrorMessage(`Failed to load demo video: ${err.message}`);
    }
  };

  // Run SAGE Inference through Python Flask backend
  const runAnalysis = async () => {
    if (!uploadedFile) {
      setErrorMessage("Please select or upload a video first.");
      return;
    }

    if (backendHealth === "offline") {
      setErrorMessage(
        "SAGE backend is offline. Please ensure the Flask server is running on port 5000."
      );
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(12);
    setActiveStepText("Step 1/4: Transferring video to SAGE forensic engine...");
    setAnalysisResult(null);
    setErrorMessage("");

    // Step progress simulation while waiting for real HTTP response
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev < 35) {
          setActiveStepText("Step 2/4: MTCNN 30-Frame Face Extraction & 224x224 Alignment...");
          return prev + 8;
        } else if (prev < 75) {
          setActiveStepText("Step 3/4: Dual-Branch Forward Pass (DINOv2 Semantics + Bayar Conv)...");
          return prev + 6;
        } else if (prev < 92) {
          setActiveStepText("Step 4/4: Disagreement α-Fusion & Final Blending Logit Computation...");
          return prev + 2;
        }
        return prev;
      });
    }, 450);

    try {
      const formData = new FormData();
      formData.append("video", uploadedFile);

      const response = await fetch(`${API_BASE}/detect`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error(data.error || `Server returned error (${response.status})`);
      }

      setAnalysisProgress(100);
      setIsAnalyzing(false);

      setAnalysisResult({
        prediction: data.prediction,
        fake_probability: data.fake_probability,
        authentic_probability: data.authentic_probability,
        confidence: data.confidence,
        logit: data.logit,
        disagreement_alpha: data.disagreement_alpha,
        frames_analyzed: data.frames_analyzed || 30,
        device: data.device || "cpu",
        timing: data.timing || null,
        metadata: data.metadata || null,
        frame_thumbnails: data.frame_thumbnails || [],
        face_detections: data.face_detections || [],
        groundTruth: activePresetObj ? activePresetObj.groundTruth : null,
      });

      // If cropped face thumbnails were returned, switch to crop view so user sees extracted faces
      if (data.frame_thumbnails && data.frame_thumbnails.length > 0) {
        setPlayerViewMode("crop");
      }
    } catch (err) {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setErrorMessage(
        err.message ||
          "Failed to connect to backend forensic API. Ensure Flask server is running on port 5000."
      );
    }
  };

  // Download Forensic JSON Report
  const downloadReport = () => {
    if (!analysisResult) return;
    const reportData = {
      project: "SAGE Deepfake Video Detection",
      architecture: "B4BayarGatedDetector (DINOv2-small + BayarConv2d)",
      timestamp: new Date().toISOString(),
      filename: uploadedFile?.name || "unknown",
      fileSizeBytes: uploadedFile?.size || 0,
      groundTruth: analysisResult.groundTruth || "NOT_SPECIFIED",
      modelOutput: {
        prediction: analysisResult.prediction,
        confidence: analysisResult.confidence,
        fakeProbability: analysisResult.fake_probability,
        authenticProbability: analysisResult.authentic_probability,
        rawLogit: analysisResult.logit,
        disagreementGateAlpha: analysisResult.disagreement_alpha,
        framesAnalyzed: analysisResult.frames_analyzed,
        device: analysisResult.device,
      },
      measuredTimingMs: analysisResult.timing || {},
      videoMetadata: analysisResult.metadata || {},
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAGE_Forensic_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Active face detection for current frame
  const currentFrameDetection =
    analysisResult?.face_detections?.[activeFrameIndex] || null;

  // Active thumbnail for current frame
  const currentFrameThumbnail =
    analysisResult?.frame_thumbnails?.[activeFrameIndex] || null;

  return (
    <div className={styles.container}>
      {/* Background glow orbs */}
      <div className={styles.ambientOrb1} />
      <div className={styles.ambientOrb2} />

      {/* TOP HEADER */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logoArea}>
            <div className={styles.logoIconWrapper}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L3 7V12C3 17.5 7 21.5 12 23C17 21.5 21 17.5 21 12V7L12 2Z"
                  fill="url(#detectShieldGrad)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="11" r="3.2" fill="#ffffff" />
                <path
                  d="M7.5 18C8.5 15.5 10.2 14.5 12 14.5C13.8 14.5 15.5 15.5 16.5 18"
                  stroke="#ffffff"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient
                    id="detectShieldGrad"
                    x1="3"
                    y1="2"
                    x2="21"
                    y2="23"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className={styles.logoText}>SAGE</span>
          </Link>

          <nav>
            <ul className={styles.navLinks}>
              <li className={styles.navItem}><Link href="/">Home</Link></li>
              <li className={`${styles.navItem} ${styles.navItemActive}`}>Detect Studio</li>
              <li className={styles.navItem}><Link href="/#how-it-works">How it Works</Link></li>
              <li className={styles.navItem}><Link href="/#features">Features</Link></li>
              <li className={styles.navItem}><Link href="/#about">About</Link></li>
            </ul>
          </nav>

          <div className={styles.headerRight}>
            {/* Dynamic System Health Badge */}
            {backendHealth === "checking" && (
              <div className={`${styles.modelBadge} ${styles.modelBadgeChecking}`}>
                <span className={`${styles.modelBadgeDot} ${styles.modelBadgeDotChecking}`} />
                <span>Connecting to SAGE Core...</span>
              </div>
            )}
            {backendHealth === "online" && (
              <div className={styles.modelBadge}>
                <span className={styles.modelBadgeDot} />
                <span>
                  SAGE Core: Online ({backendInfo?.device ? backendInfo.device.toUpperCase() : "CPU"})
                </span>
              </div>
            )}
            {backendHealth === "offline" && (
              <div
                className={`${styles.modelBadge} ${styles.modelBadgeOffline}`}
                onClick={checkHealth}
                style={{ cursor: "pointer" }}
                title="Click to re-check backend connection"
              >
                <span className={`${styles.modelBadgeDot} ${styles.modelBadgeDotOffline}`} />
                <span>SAGE Core: Offline (Retry)</span>
              </div>
            )}
            {backendHealth === "not_ready" && (
              <div className={`${styles.modelBadge} ${styles.modelBadgeWarning}`}>
                <span className={`${styles.modelBadgeDot} ${styles.modelBadgeDotWarning}`} />
                <span>SAGE Core: Model Initializing...</span>
              </div>
            )}

            <Link href="/" className={styles.backHomeBtn}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* MAIN STUDIO WORKSPACE */}
      <main className={styles.mainWorkspace}>
        {/* Studio Heading Banner */}
        <div className={styles.studioBanner}>
          <div className="pill-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span>Neural Video Forensic Workspace</span>
          </div>
          <h1 className={styles.studioHeading}>
            Upload Video for <span className="gradient-text-hero">Deepfake Detection</span>
          </h1>
          <p className={styles.studioSubtitle}>
            Submit any face video to run SAGE&apos;s dual-branch neural architecture. Examines 30 sequential frames with MTCNN face alignment, DINOv2 semantics, and 5x5 Bayar constrained convolution.
          </p>
        </div>

        {/* 2-Column Grid */}
        <div className={styles.workspaceGrid}>
          {/* LEFT COLUMN: Upload & Configuration Console */}
          <div className={styles.uploadConsole}>
            {/* Panel 1: File Dropzone */}
            <div className={styles.consolePanel}>
              <div className={styles.panelTitleRow}>
                <span className={styles.panelTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  Select Video Source
                </span>
                <span className={styles.panelBadge}>Step 1</span>
              </div>

              {/* Drag and Drop Zone */}
              <div
                className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ""}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={styles.dropIconCircle}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div>
                  <p className={styles.dropzoneTitle}>
                    {uploadedFile ? "Replace or Choose Another Video" : "Drag & drop video here, or browse files"}
                  </p>
                  <p className={styles.dropzoneSubtitle}>
                    Automatic 30-frame MTCNN face extraction will be performed
                  </p>
                  <p className={styles.dropzoneFormats}>MP4, MOV, WebM, AVI, MKV (up to 100MB)</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className={styles.hiddenFileInput}
                  accept="video/mp4,video/avi,video/quicktime,video/x-matroska,video/webm"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Selected File Details Bar with Clear Option */}
              {uploadedFile && (
                <div className={styles.fileMetaRow}>
                  <div className={styles.fileMetaInfo}>
                    <span className={styles.fileMetaName} title={uploadedFile.name}>
                      {uploadedFile.name}
                    </span>
                    <span className={styles.fileMetaSub}>
                      {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for SAGE analysis
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.btnRemoveFile}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSelectedVideo();
                    }}
                    title="Remove and reset selected video"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>Remove</span>
                  </button>
                </div>
              )}

              {/* Demo Benchmark Samples Section */}
              <div className={styles.samplesSection}>
                <span className={styles.samplesLabel}>Or test with verified demo benchmark videos:</span>
                <div className={styles.sampleButtonsGrid}>
                  {demoSamples.map((sample) => (
                    <div
                      key={sample.id}
                      className={`${styles.sampleCardBtn} ${
                        activePreset === sample.id ? styles.sampleCardBtnSelected : ""
                      }`}
                      onClick={() => selectDemoSample(sample)}
                    >
                      <div className={styles.sampleInfoLeft}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "8px",
                            background: "rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(255, 255, 255, 0.12)",
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                            <polygon points="5 3 19 12 5 21 5 3" fill="rgba(56, 189, 248, 0.3)"></polygon>
                          </svg>
                        </div>
                        <div>
                          <div className={styles.sampleName}>{sample.name}</div>
                          <div className={styles.sampleTypeTag}>{sample.details}</div>
                        </div>
                      </div>
                      <span className={sample.badgeColor}>
                        GT: {sample.groundTruth}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel 2: SAGE Model Parameters */}
            <div className={styles.consolePanel}>
              <div className={styles.panelTitleRow}>
                <span className={styles.panelTitle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  Pipeline Configuration
                </span>
                <span className={styles.panelBadge}>Trained Weights</span>
              </div>

              <div className={styles.paramsGrid}>
                <div className={styles.paramBox}>
                  <span className={styles.paramLabel}>Frame Budget</span>
                  <span className={styles.paramValue}>30 Frames (224x224)</span>
                </div>
                <div className={styles.paramBox}>
                  <span className={styles.paramLabel}>Semantic Backbone</span>
                  <span className={styles.paramValue}>DINOv2-small (Frozen)</span>
                </div>
                <div className={styles.paramBox}>
                  <span className={styles.paramLabel}>Forensic Kernel</span>
                  <span className={styles.paramValue}>5x5 Learnable Bayar</span>
                </div>
                <div className={styles.paramBox}>
                  <span className={styles.paramLabel}>Fusion Mechanism</span>
                  <span className={styles.paramValue}>Disagreement α-Gate</span>
                </div>
              </div>

              {/* Start Scan Button */}
              <button
                className={styles.btnRunScan}
                disabled={isAnalyzing || !uploadedFile || backendHealth === "offline"}
                onClick={runAnalysis}
              >
                {isAnalyzing ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                    </svg>
                    <span>Running Real SAGE Neural Inference...</span>
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"></polygon>
                    </svg>
                    <span>Start SAGE Forensic Analysis</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Diagnostic & Results Console */}
          <div className={styles.diagnosticConsole}>
            {/* Error Notification Alert */}
            {errorMessage && (
              <div className={styles.errorAlert}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Player / Preview Card */}
            <div className={styles.playerCard}>
              {/* View mode toggle (if extracted thumbnails are available) */}
              {analysisResult?.frame_thumbnails && analysisResult.frame_thumbnails.length > 0 && (
                <div className={styles.viewModeToggleRow}>
                  <button
                    type="button"
                    className={`${styles.viewModeBtn} ${playerViewMode === "video" ? styles.viewModeBtnActive : ""}`}
                    onClick={() => setPlayerViewMode("video")}
                  >
                    Raw Video
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewModeBtn} ${playerViewMode === "crop" ? styles.viewModeBtnActive : ""}`}
                    onClick={() => setPlayerViewMode("crop")}
                  >
                    SAGE Face Crop #{activeFrameIndex}
                  </button>
                </div>
              )}

              {/* Video Element or Extracted Crop Display */}
              {playerViewMode === "crop" && currentFrameThumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentFrameThumbnail}
                  alt={`Cropped face for frame ${activeFrameIndex}`}
                  className={styles.playerMedia}
                  style={{ objectFit: "contain", background: "#0a0f22" }}
                />
              ) : videoPreviewUrl ? (
                <video
                  ref={videoElementRef}
                  src={videoPreviewUrl}
                  controls
                  className={styles.playerMedia}
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <div className={styles.emptyPlayerState}>
                  <div className={styles.emptyPlayerIcon}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  </div>
                  <div>
                    <strong style={{ color: "#ffffff", display: "block", marginBottom: "4px" }}>
                      No Video Loaded
                    </strong>
                    <span>Upload a face video or choose a benchmark demo sample to begin</span>
                  </div>
                </div>
              )}

              {/* HUD Overlay on Video Player */}
              <div className={styles.playerHudOverlay}>
                <div className={styles.hudTopBar}>
                  <div className={`${styles.hudChip} ${isAnalyzing ? styles.hudChipLive : ""}`}>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: isAnalyzing ? "#f43f5e" : "#38bdf8",
                      }}
                    />
                    <span>
                      {isAnalyzing
                        ? "ANALYZING • SAGE ACTIVE"
                        : analysisResult
                        ? "INSPECTION COMPLETE"
                        : "IDLE • AWAITING VIDEO"}
                    </span>
                  </div>

                  <div className={styles.hudChip}>
                    <span>
                      {analysisResult?.metadata
                        ? `${analysisResult.metadata.video_fps} FPS • ${analysisResult.metadata.video_resolution} RGB`
                        : "30 FRAMES • 224x224 RGB"}
                    </span>
                  </div>
                </div>

                {/* Face Tracker Bounding Box - Shown truthfully only when face detection is available */}
                {analysisResult && (
                  <div className={styles.faceBoundingBox}>
                    <div className={styles.boxLabel}>
                      {currentFrameDetection?.detected && currentFrameDetection.confidence !== null
                        ? `FACE DETECTED (CONF: ${(currentFrameDetection.confidence * 100).toFixed(1)}%)`
                        : "FACE TRACKING (INTERPOLATED)"}
                    </div>
                    <div className={styles.boxCorners}>
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderBottom: "2px solid #38bdf8",
                          borderLeft: "2px solid #38bdf8",
                        }}
                      />
                      <div className={styles.boxCornerCross} />
                    </div>
                  </div>
                )}

                {/* Active Laser Scanner Line */}
                {isAnalyzing && <div className={styles.laserScannerLine} />}

                {/* Bottom HUD Bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.hudChip}>
                    FRAME: {activeFrameIndex} / 29 (TOTAL: 30)
                  </span>
                  <span className={styles.hudChip}>
                    SAGE CORE: {backendHealth.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* 30-Frame Filmstrip Timeline Scrubber */}
            <div className={styles.timelineScrubber}>
              <div className={styles.timelineHeader}>
                <span>
                  {analysisResult?.frame_thumbnails?.length === 30
                    ? "30-Frame MTCNN Facial Alignments (Extracted from Video)"
                    : "30-Frame Sequence Timeline (Extracted by SAGE Pipeline on Analysis)"}
                </span>
                <span>Frame #{activeFrameIndex} of 30</span>
              </div>

              <div className={styles.framesTrack}>
                {filmFrames.map((frameNum) => {
                  const thumb = analysisResult?.frame_thumbnails?.[frameNum];
                  return thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={frameNum}
                      src={thumb}
                      alt={`Frame ${frameNum}`}
                      className={`${styles.frameThumbnailBox} ${
                        activeFrameIndex === frameNum ? styles.frameThumbnailActive : ""
                      }`}
                      onClick={() => setActiveFrameIndex(frameNum)}
                    />
                  ) : (
                    <div
                      key={frameNum}
                      className={`${styles.frameThumbnailPlaceholder} ${
                        activeFrameIndex === frameNum ? styles.frameThumbnailPlaceholderActive : ""
                      }`}
                      onClick={() => setActiveFrameIndex(frameNum)}
                      title={`Frame #${frameNum} - Populated after SAGE analysis`}
                    >
                      #{frameNum}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pipeline Stepper (Active during analysis) */}
            {isAnalyzing && (
              <div className={styles.pipelineStepper}>
                <div className={styles.pipelineHeader}>
                  <span>{activeStepText}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#38bdf8" }}>
                    {analysisProgress}%
                  </span>
                </div>
                <div className={styles.pipelineProgressTrack}>
                  <div
                    className={styles.pipelineProgressFill}
                    style={{ width: `${analysisProgress}%` }}
                  />
                </div>
                <div className={styles.pipelineStepsList}>
                  <span>MTCNN Alignment</span>
                  <span>DINOv2 Semantics</span>
                  <span>Bayar High-Pass</span>
                  <span>Gate Fusion</span>
                </div>
              </div>
            )}

            {/* Final Verdict Card (After Real Backend Analysis) */}
            {analysisResult && (
              <div
                className={`${styles.verdictCard} ${
                  analysisResult.prediction === "FAKE"
                    ? styles.verdictFake
                    : styles.verdictReal
                }`}
              >
                <div className={styles.verdictTopRow}>
                  <div
                    className={
                      analysisResult.prediction === "FAKE"
                        ? styles.verdictBadgeFake
                        : styles.verdictBadgeReal
                    }
                  >
                    <span>
                      {analysisResult.prediction === "FAKE"
                        ? "⚠️ MANIPULATED / FAKE"
                        : "✓ AUTHENTIC / REAL"}
                    </span>
                    <span>({analysisResult.confidence})</span>
                  </div>

                  <div className={styles.verdictLatencyChip}>
                    Server Latency:{" "}
                    <strong style={{ color: "#ffffff" }}>
                      {analysisResult.timing ? `${analysisResult.timing.total_ms} ms` : "Completed"}
                    </strong>
                  </div>
                </div>

                {/* Ground Truth Validation Comparison (if running a benchmark demo sample) */}
                {analysisResult.groundTruth && (
                  <div className={styles.verdictGtRow}>
                    <span>Known Benchmark Ground Truth:</span>
                    <strong>{analysisResult.groundTruth}</strong>
                    <span>•</span>
                    <span>Evaluation:</span>
                    <span
                      className={
                        analysisResult.prediction === analysisResult.groundTruth
                          ? styles.gtBadgeMatch
                          : styles.gtBadgeMismatch
                      }
                    >
                      {analysisResult.prediction === analysisResult.groundTruth
                        ? "✓ Model Prediction Matches Ground Truth"
                        : "⚠️ Prediction Differs from Ground Truth"}
                    </span>
                  </div>
                )}

                {/* Scientific Description */}
                <p className={styles.verdictDescription}>
                  {analysisResult.prediction === "FAKE"
                    ? `Bayar 5x5 constrained convolution and DINOv2 temporal attention identified high-frequency spatial noise and boundary artifacts across the 30-frame sequence. Disagreement gate blended decision into MANIPULATED with ${analysisResult.confidence} confidence (raw logit: ${analysisResult.logit > 0 ? "+" : ""}${analysisResult.logit.toFixed(4)}).`
                    : `Dual-branch neural analysis confirmed spatial-temporal consistency across all 30 extracted facial frames. Gated fusion classified video as AUTHENTIC with ${analysisResult.confidence} confidence (raw logit: ${analysisResult.logit.toFixed(4)}).`}
                </p>

                {/* Real Measured Timing Breakdown */}
                {analysisResult.timing && (
                  <div className={styles.timingBreakdownBox}>
                    <div className={styles.timingRow}>
                      <span className={styles.timingLabel}>MTCNN Face Preprocessing (30 Frames):</span>
                      <span className={styles.timingVal}>{analysisResult.timing.preprocessing_ms} ms</span>
                    </div>
                    <div className={styles.timingRow}>
                      <span className={styles.timingLabel}>SAGE Dual-Branch Model Inference:</span>
                      <span className={styles.timingVal}>
                        {analysisResult.timing.inference_ms} ms (
                        {(30 / (analysisResult.timing.inference_ms / 1000)).toFixed(1)} FPS on {analysisResult.device.toUpperCase()})
                      </span>
                    </div>
                    <div className={styles.timingRow}>
                      <span className={styles.timingLabel}>Total Server Request Processing Time:</span>
                      <span className={styles.timingVal}>{analysisResult.timing.total_ms} ms</span>
                    </div>
                  </div>
                )}

                {/* Truthful Model Telemetry Matrix */}
                <div className={styles.telemetryGrid}>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Fake Probability</span>
                    <span className={styles.telemetryValue} style={{ color: "#f43f5e" }}>
                      {(analysisResult.fake_probability * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Authentic Probability</span>
                    <span className={styles.telemetryValue} style={{ color: "#34d399" }}>
                      {(analysisResult.authentic_probability * 100).toFixed(2)}%
                    </span>
                  </div>

                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Model Logit</span>
                    <span className={styles.telemetryValue} style={{ color: "#38bdf8" }}>
                      {analysisResult.logit > 0 ? `+${analysisResult.logit.toFixed(4)}` : analysisResult.logit.toFixed(4)}
                    </span>
                  </div>

                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Gating Weight (α)</span>
                    <span className={styles.telemetryValue} style={{ color: "#c084fc" }}>
                      {analysisResult.disagreement_alpha.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className={styles.verdictActionsRow}>
                  <button className={styles.btnDownloadReport} onClick={downloadReport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Download Forensic Report (.json)</span>
                  </button>

                  <button
                    className={styles.btnResetScan}
                    onClick={removeSelectedVideo}
                  >
                    <span>Analyze Another Video</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
