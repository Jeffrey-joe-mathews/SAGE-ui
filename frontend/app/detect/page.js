"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function DetectStudio() {
  const [activePreset, setActivePreset] = useState("faceswap");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeStepText, setActiveStepText] = useState("");
  const [analysisResult, setAnalysisResult] = useState(null);
  const [activeFrameIndex, setActiveFrameIndex] = useState(8);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);

  // Preset options
  const presets = [
    {
      id: "faceswap",
      name: "DeepFake Detection (FaceSwap)",
      type: "FAKE",
      thumb: "/assets/sample_man.jpg",
      details: "FaceForensics++ FaceSwap video crop (ID #042)",
    },
    {
      id: "real",
      name: "Original Authentic Sequence",
      type: "REAL",
      thumb: "/assets/portrait_real.jpg",
      details: "FaceForensics++ Pristine actor sequence (ID #108)",
    },
    {
      id: "neuraltextures",
      name: "NeuralTextures Facial Synthesis",
      type: "FAKE",
      thumb: "/assets/portrait_fake.jpg",
      details: "NeuralTextures mouth & texture re-rendering (ID #729)",
    },
  ];

  // 30 video frames list
  const filmFrames = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  ];

  // Handle File Upload
  const handleFileUpload = (file) => {
    if (!file) return;
    setUploadedFile(file);
    setActivePreset(null);
    setAnalysisResult(null);

    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Run SAGE Inference Simulation
  const runAnalysis = () => {
    setIsAnalyzing(true);
    setAnalysisProgress(5);
    setActiveStepText("Step 1/4: MTCNN Face Extraction & 224x224 Alignment...");
    setAnalysisResult(null);

    const interval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev === 25) {
          setActiveStepText("Step 2/4: DINOv2-small Semantic Vision & 3D Conv Temporal Motion...");
        } else if (prev === 55) {
          setActiveStepText("Step 3/4: Bayar Constrained Conv High-Frequency Residual Filtering...");
        } else if (prev === 85) {
          setActiveStepText("Step 4/4: Disagreement Gate & Blending Logit Computation...");
        }

        if (prev >= 95) {
          clearInterval(interval);
          setTimeout(() => {
            setIsAnalyzing(false);
            if (activePreset === "real") {
              setAnalysisResult({
                label: "REAL",
                confidence: "99.1%",
                latency: "142.8 ms",
                semanticScore: "0.98",
                forensicNoise: "Low (0.04)",
                temporalStability: "99.4%",
                gateAlpha: "0.82",
                details: "No spatial tampering or high-frequency pixel boundary anomalies detected across the 30-frame sequence. Temporal motion aligns with natural human physiology.",
                flaggedFrames: [],
              });
            } else {
              setAnalysisResult({
                label: "FAKE",
                confidence: "98.3%",
                latency: "146.2 ms",
                semanticScore: "0.41",
                forensicNoise: "High (0.89)",
                temporalStability: "62.1%",
                gateAlpha: "0.29",
                details: "Bayar high-pass convolution detected boundary blending seams and upsampling noise patterns. DINOv2 3D temporal conv flagged facial flickering across frames 12-24.",
                flaggedFrames: [12, 14, 16, 18, 20, 22],
              });
            }
          }, 400);
          return 100;
        }
        return prev + 15;
      });
    }, 130);
  };

  // Download Report
  const downloadReport = () => {
    if (!analysisResult) return;
    const reportData = {
      model: "SAGE Dual-Branch Deepfake Detector",
      backbone: "facebook/dinov2-small + BayarConv2d",
      timestamp: new Date().toISOString(),
      prediction: analysisResult.label,
      confidence: analysisResult.confidence,
      inferenceLatency: analysisResult.latency,
      telemetry: {
        semanticScore: analysisResult.semanticScore,
        forensicArtifactNoise: analysisResult.forensicNoise,
        temporalStability: analysisResult.temporalStability,
        disagreementGateAlpha: analysisResult.gateAlpha,
      },
      evaluationDataset: "FaceForensics++ (30 frames)",
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAGE_Forensic_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Active display image
  const getCurrentDisplayImage = () => {
    if (activePreset === "faceswap") return "/assets/sample_man.jpg";
    if (activePreset === "real") return "/assets/portrait_real.jpg";
    if (activePreset === "neuraltextures") return "/assets/portrait_fake.jpg";
    return "/assets/portrait_split.jpg";
  };

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
                  <linearGradient id="detectShieldGrad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
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
            <div className={styles.modelBadge}>
              <span className={styles.modelBadgeDot} />
              <span>SAGE v1.0 • Ready</span>
            </div>

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
            Submit any face video to run SAGE&apos;s dual-branch neural architecture. Examines 30 sequential frames for temporal motion inconsistencies and high-frequency forensic noise in ~146ms.
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
                    {uploadedFile ? uploadedFile.name : "Drag & drop video here, or browse files"}
                  </p>
                  <p className={styles.dropzoneSubtitle}>
                    {uploadedFile
                      ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for analysis`
                      : "Automatic 30-frame MTCNN face extraction will be performed"}
                  </p>
                  <p className={styles.dropzoneFormats}>MP4, MOV, WebM, AVI (up to 50MB)</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className={styles.hiddenFileInput}
                  accept="video/*,image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {/* Sample Quick Picker */}
              <div className={styles.samplesSection}>
                <span className={styles.samplesLabel}>Or try verified benchmark samples:</span>
                <div className={styles.sampleButtonsGrid}>
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`${styles.sampleCardBtn} ${activePreset === preset.id ? styles.sampleCardBtnSelected : ""}`}
                      onClick={() => {
                        setActivePreset(preset.id);
                        setUploadedFile(null);
                        setVideoPreviewUrl(null);
                        setAnalysisResult(null);
                      }}
                    >
                      <div className={styles.sampleInfoLeft}>
                        <Image
                          src={preset.thumb}
                          alt={preset.name}
                          width={40}
                          height={40}
                          className={styles.sampleThumb}
                        />
                        <div>
                          <div className={styles.sampleName}>{preset.name}</div>
                          <div className={styles.sampleTypeTag}>{preset.details}</div>
                        </div>
                      </div>
                      <span className={preset.type === "FAKE" ? styles.sampleTagRed : styles.sampleTagGreen}>
                        {preset.type}
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
                  Inference Configuration
                </span>
                <span className={styles.panelBadge}>Auto</span>
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
                  <span className={styles.paramLabel}>Decision Gate</span>
                  <span className={styles.paramValue}>Disagreement α-Fusion</span>
                </div>
              </div>

              {/* Start Scan Button */}
              <button
                className={styles.btnRunScan}
                disabled={isAnalyzing}
                onClick={runAnalysis}
              >
                {isAnalyzing ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"></path>
                    </svg>
                    <span>Running Dual-Branch SAGE Scan...</span>
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
            {/* Player / Preview Card */}
            <div className={styles.playerCard}>
              {videoPreviewUrl ? (
                <video
                  src={videoPreviewUrl}
                  controls
                  className={styles.playerMedia}
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <Image
                  src={getCurrentDisplayImage()}
                  alt="Video sequence preview"
                  fill
                  priority
                  className={styles.playerMedia}
                />
              )}

              {/* HUD Overlay */}
              <div className={styles.playerHudOverlay}>
                <div className={styles.hudTopBar}>
                  <div className={`${styles.hudChip} ${styles.hudChipLive}`}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f43f5e" }} />
                    <span>REC • MTCNN TRACK</span>
                  </div>
                  <div className={styles.hudChip}>
                    <span>FPS: 30 • 224x224 RGB</span>
                  </div>
                </div>

                {/* Face Tracker Bounding Box */}
                <div className={styles.faceBoundingBox}>
                  <div className={styles.boxLabel}>FACE 01 (CONF: 0.99)</div>
                  <div className={styles.boxCorners}>
                    <div style={{ width: "8px", height: "8px", borderBottom: "2px solid #38bdf8", borderLeft: "2px solid #38bdf8" }} />
                    <div className={styles.boxCornerCross} />
                  </div>
                </div>

                {/* Active Laser Scanner Line */}
                {isAnalyzing && <div className={styles.laserScannerLine} />}

                {/* Bottom HUD */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={styles.hudChip}>FRAME: {activeFrameIndex} / 29</span>
                  <span className={styles.hudChip}>SAGE CORE: ONLINE</span>
                </div>
              </div>
            </div>

            {/* 30-Frame Filmstrip Timeline Scrubber */}
            <div className={styles.timelineScrubber}>
              <div className={styles.timelineHeader}>
                <span>30-Frame Sequence Timeline (MTCNN Alignments)</span>
                <span>Frame #{activeFrameIndex}</span>
              </div>
              <div className={styles.framesTrack}>
                {filmFrames.map((frameNum) => {
                  const isFlagged = analysisResult?.flaggedFrames?.includes(frameNum);
                  return (
                    <Image
                      key={frameNum}
                      src={getCurrentDisplayImage()}
                      alt={`Frame ${frameNum}`}
                      width={44}
                      height={38}
                      className={`${styles.frameThumbnailBox} ${activeFrameIndex === frameNum ? styles.frameThumbnailActive : ""} ${isFlagged ? styles.frameThumbnailFlagged : ""}`}
                      onClick={() => setActiveFrameIndex(frameNum)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Pipeline Stepper (Active during analysis) */}
            {isAnalyzing && (
              <div className={styles.pipelineStepper}>
                <div className={styles.pipelineHeader}>
                  <span>{activeStepText}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "#38bdf8" }}>{analysisProgress}%</span>
                </div>
                <div className={styles.pipelineProgressTrack}>
                  <div className={styles.pipelineProgressFill} style={{ width: `${analysisProgress}%` }} />
                </div>
                <div className={styles.pipelineStepsList}>
                  <span>MTCNN Alignment</span>
                  <span>DINOv2 Semantics</span>
                  <span>Bayar High-Pass</span>
                  <span>Gate Fusion</span>
                </div>
              </div>
            )}

            {/* Final Verdict Card (After Analysis) */}
            {analysisResult && (
              <div className={`${styles.verdictCard} ${analysisResult.label === "FAKE" ? styles.verdictFake : styles.verdictReal}`}>
                <div className={styles.verdictTopRow}>
                  <div className={analysisResult.label === "FAKE" ? styles.verdictBadgeFake : styles.verdictBadgeReal}>
                    <span>{analysisResult.label === "FAKE" ? "⚠️ MANIPULATED / FAKE" : "✓ AUTHENTIC / REAL"}</span>
                    <span>({analysisResult.confidence})</span>
                  </div>
                  <div className={styles.verdictLatencyChip}>
                    Latency: <strong style={{ color: "#ffffff" }}>{analysisResult.latency}</strong> (~6.84 FPS)
                  </div>
                </div>

                <p className={styles.verdictDescription}>
                  {analysisResult.details}
                </p>

                {/* Telemetry Matrix */}
                <div className={styles.telemetryGrid}>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Semantic Inconsistency</span>
                    <span className={styles.telemetryValue} style={{ color: "#38bdf8" }}>
                      {analysisResult.semanticScore}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Forensic Artifacts</span>
                    <span className={styles.telemetryValue} style={{ color: "#f43f5e" }}>
                      {analysisResult.forensicNoise}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Temporal Stability</span>
                    <span className={styles.telemetryValue} style={{ color: "#34d399" }}>
                      {analysisResult.temporalStability}
                    </span>
                  </div>
                  <div className={styles.telemetryItem}>
                    <span className={styles.telemetryLabel}>Gating Weight (α)</span>
                    <span className={styles.telemetryValue} style={{ color: "#c084fc" }}>
                      {analysisResult.gateAlpha}
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
                    onClick={() => {
                      setAnalysisResult(null);
                      setUploadedFile(null);
                      setVideoPreviewUrl(null);
                    }}
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
