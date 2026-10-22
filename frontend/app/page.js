"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  const [activeTab, setActiveTab] = useState("Home");
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(14);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [selectedSample, setSelectedSample] = useState("deepfake");

  const visualRef = useRef(null);

  // Handle Dragging for Face Split Slider
  const handleMove = (clientX) => {
    if (!visualRef.current) return;
    const rect = visualRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clamped = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(clamped);
  };

  const handleTouchMove = (e) => {
    if (isDragging && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging]);

  // Run Simulated SAGE Inference Pipeline
  const runSimulatedInference = (sampleType) => {
    setIsAnalyzing(true);
    setAnalysisProgress(10);
    setAnalysisResult(null);

    const stepInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 95) {
          clearInterval(stepInterval);
          setTimeout(() => {
            setIsAnalyzing(false);
            if (sampleType === "real") {
              setAnalysisResult({
                label: "REAL",
                confidence: "99.1%",
                latency: "142.8 ms",
                semanticScore: "0.98",
                forensicNoise: "Low (0.04)",
                gateAlpha: "0.82",
                details: "No spatial tampering or frequency anomalies detected across 30 MTCNN frames.",
              });
            } else {
              setAnalysisResult({
                label: "FAKE",
                confidence: "98.3%",
                latency: "146.2 ms",
                semanticScore: "0.41",
                forensicNoise: "High (0.89)",
                gateAlpha: "0.29",
                details: "Bayar filter detected high-pass frequency boundary seams and DINOv2 temporal flicker.",
              });
            }
          }, 350);
          return 100;
        }
        return prev + 20;
      });
    }, 120);
  };

  const filmFrames = [
    0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 29
  ];

  return (
    <div className={styles.container}>
      {/* Ambient glowing backdrops */}
      <div className={styles.ambientOrb1} />
      <div className={styles.ambientOrb2} />
      <div className={styles.ambientOrb3} />

      {/* TOP NAVBAR */}
      <header className={styles.header}>
        <div className={styles.logoArea} onClick={() => setActiveTab("Home")}>
          <div className={styles.logoIconWrapper}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L3 7V12C3 17.5 7 21.5 12 23C17 21.5 21 17.5 21 12V7L12 2Z"
                fill="url(#shieldGrad)"
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
                <linearGradient id="shieldGrad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#3b82f6" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className={styles.logoText}>SAGE</span>
        </div>

        <nav>
          <ul className={styles.navLinks}>
            {["Home", "How it Works", "Try It", "Features", "About"].map((item) => (
              <li
                key={item}
                className={`${styles.navItem} ${activeTab === item ? styles.navItemActive : ""}`}
                onClick={() => {
                  setActiveTab(item);
                  if (item === "Try It") setIsModalOpen(true);
                  if (item === "How it Works") {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }
                  if (item === "Features") {
                    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                  }
                  if (item === "About") {
                    document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </nav>

        <button className={styles.navCta} onClick={() => setIsModalOpen(true)}>
          <span>Get Started</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </header>

      {/* HERO SECTION */}
      <main className={styles.heroSection}>
        {/* Left Column: Heading, text, CTAs, metrics */}
        <div className={styles.heroLeft}>
          <div className={styles.pillBadgeWrapper}>
            <div className="pill-badge">
              <svg className={styles.pulseIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              <span>AI-Powered Deepfake Detection</span>
            </div>
          </div>

          <h1 className={styles.heroHeading}>
            Detect <span className="gradient-text-hero">Deepfakes</span> Before They Deceive
          </h1>

          <p className={styles.heroDescription}>
            SAGE is an advanced, lightweight AI model that analyzes faces, movements, and hidden pixel patterns to detect manipulated videos with high accuracy.
          </p>

          <div className={styles.heroActions}>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <span>Upload a Video</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>

            <button
              className="btn-secondary"
              onClick={() => {
                document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <svg className={styles.playIconOutline} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
              </svg>
              <span>Learn How It Works</span>
            </button>
          </div>

          {/* Metrics row */}
          <div className={styles.metricsRow}>
            <div className={styles.metricItem}>
              <span className={styles.metricValue} style={{ color: "var(--accent-cyan)" }}>94.8%</span>
              <span className={styles.metricLabel}>Test AUC</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricValue} style={{ color: "#60a5fa" }}>91.99%</span>
              <span className={styles.metricLabel}>Accuracy</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricValue} style={{ color: "var(--accent-green-bright)" }}>0.9535</span>
              <span className={styles.metricLabel}>F1 Score</span>
            </div>
            <div className={styles.metricItem}>
              <span className={styles.metricValue} style={{ color: "var(--accent-red)" }}>146 ms</span>
              <span className={styles.metricLabel}>Inference Time</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visualizer with Real/Fake Interactive Face Split */}
        <div className={styles.heroRight}>
          <div className={styles.visualContainer} ref={visualRef}>
            {/* Neon rim glows */}
            <div className={styles.rimGlowCyan} />
            <div className={styles.rimGlowRed} />

            {/* REAL / FAKE Labels on top */}
            <div className={styles.badgeReal}>REAL</div>
            <div className={styles.badgeFake}>FAKE</div>

            {/* Floating Card 1: Semantic Analysis (Left) */}
            <div className={`${styles.cardSemantic} floating-card-1`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Semantic Analysis</span>
                <span className={styles.cardSubtitle}>(face & motion)</span>
              </div>
              <div className={styles.cardBody}>
                <Image
                  src="/assets/portrait_real.jpg"
                  alt="Semantic thumbnail"
                  width={38}
                  height={38}
                  className={styles.cardThumb}
                />
                <svg className={styles.waveformSvg} viewBox="0 0 100 30" fill="none">
                  <path
                    d="M 0 15 Q 10 5, 20 15 T 40 15 T 60 5 T 80 25 T 100 15"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Floating Card 2: Forensic Analysis (Right) */}
            <div className={`${styles.cardForensic} floating-card-2`}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Forensic Analysis</span>
                <span className={styles.cardSubtitleRed}>(pixel artifacts)</span>
              </div>
              <div className={styles.cardBody}>
                <Image
                  src="/assets/noise_map.jpg"
                  alt="Forensic noise map"
                  width={38}
                  height={38}
                  className={styles.cardThumb}
                />
                <svg className={styles.waveformSvg} viewBox="0 0 100 30" fill="none">
                  <path
                    d="M 0 15 Q 10 28, 25 2 T 50 29 T 75 4 T 100 15"
                    stroke="#f43f5e"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            {/* Floating Card 3: Prediction Box (Bottom Right) */}
            <div className={`${styles.cardPrediction} floating-card-3`}>
              <div className={styles.predictionTitle}>
                Prediction: <span className={styles.predictionHighlight}>FAKE</span>
              </div>
              <div className={styles.predictionConfidence}>
                Confidence: 98.3%
              </div>
              <div className={styles.confidenceTrack}>
                <div className={styles.confidenceFill} style={{ width: "98.3%" }} />
              </div>
            </div>

            {/* Face Split Screen Container */}
            <div className={styles.faceFrame}>
              {/* Fake Face (Base Layer - Right Side) */}
              <Image
                src="/assets/portrait_fake.jpg"
                alt="Face portrait manipulated"
                fill
                priority
                className={styles.imageLayerFake}
              />

              {/* Digital artifact pixelation overlay on the fake area */}
              <div
                className={styles.glitchGridOverlay}
                style={{ left: `${sliderPos}%` }}
              />

              {/* Real Face (Clipped Layer - Left Side) */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: `${sliderPos}%`,
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "relative", width: visualRef.current?.offsetWidth || 520, height: "100%" }}>
                  <Image
                    src="/assets/portrait_real.jpg"
                    alt="Face portrait original"
                    fill
                    priority
                    className={styles.imageLayerReal}
                  />
                </div>
              </div>

              {/* Draggable Laser Divider */}
              <div
                className={styles.laserDivider}
                style={{ left: `${sliderPos}%` }}
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={() => setIsDragging(true)}
              >
                <div className={styles.laserHandle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"></polyline>
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>

              {/* Bottom 30-Frame Filmstrip */}
              <div className={styles.filmstripWrapper}>
                <div className={styles.filmstripFrameList}>
                  {filmFrames.map((frameNum, idx) => (
                    <Image
                      key={frameNum}
                      src={idx > 7 ? "/assets/portrait_fake.jpg" : "/assets/portrait_real.jpg"}
                      alt={`Frame ${frameNum}`}
                      width={44}
                      height={38}
                      className={`${styles.filmstripFrame} ${activeFrameIndex === idx ? styles.filmstripFrameActive : ""}`}
                      onClick={() => setActiveFrameIndex(idx)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* PROCESS WORKFLOW STEPS BANNER */}
      <section className={styles.processBannerWrapper}>
        <div className={styles.processBanner}>
          {/* Step 1 */}
          <div className={styles.stepCard}>
            <div
              className={styles.stepIconCircle}
              style={{
                background: "rgba(139, 92, 246, 0.2)",
                border: "1px solid rgba(139, 92, 246, 0.4)",
                color: "#c084fc",
                boxShadow: "0 0 15px rgba(139, 92, 246, 0.35)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="4"></rect>
                <polygon points="10 9 15 12 10 15 10 9" fill="currentColor"></polygon>
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Upload a Video</h3>
            <p className={styles.stepDesc}>Simply upload a video and let SAGE analyze it.</p>
          </div>

          <span className={styles.stepDividerChevron}>›</span>

          {/* Step 2 */}
          <div className={styles.stepCard}>
            <div
              className={styles.stepIconCircle}
              style={{
                background: "rgba(56, 189, 248, 0.2)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                color: "#38bdf8",
                boxShadow: "0 0 15px rgba(56, 189, 248, 0.35)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </div>
            <h3 className={styles.stepTitle}>AI-Powered Analysis</h3>
            <p className={styles.stepDesc}>Our model examines facial movements and pixel-level artifacts across video frames.</p>
          </div>

          <span className={styles.stepDividerChevron}>›</span>

          {/* Step 3 */}
          <div className={styles.stepCard}>
            <div
              className={styles.stepIconCircle}
              style={{
                background: "rgba(217, 70, 239, 0.2)",
                border: "1px solid rgba(217, 70, 239, 0.4)",
                color: "#e879f9",
                boxShadow: "0 0 15px rgba(217, 70, 239, 0.35)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Get Instant Results</h3>
            <p className={styles.stepDesc}>Receive a real or fake prediction with a confidence score.</p>
          </div>

          <span className={styles.stepDividerChevron}>›</span>

          {/* Step 4 */}
          <div className={styles.stepCard}>
            <div
              className={styles.stepIconCircle}
              style={{
                background: "rgba(16, 185, 129, 0.2)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#34d399",
                boxShadow: "0 0 15px rgba(16, 185, 129, 0.35)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <h3 className={styles.stepTitle}>Help Build a Safer Internet</h3>
            <p className={styles.stepDesc}>Detect manipulated content and help stop misinformation.</p>
          </div>
        </div>
      </section>

      {/* Scroll indicator */}
      <div
        className={styles.scrollIndicator}
        onClick={() => {
          document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
        }}
      >
        <div className={styles.scrollCircle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <span>Scroll to explore</span>
      </div>

      {/* SECTION: HOW IT WORKS */}
      <section id="how-it-works" className={styles.contentSection}>
        <div className={styles.sectionHeader}>
          <div className="pill-badge">Dual-Branch Architecture</div>
          <h2 className={styles.sectionTitle}>How SAGE Solves the Deepfake Paradox</h2>
          <p className={styles.sectionSubtitle}>
            Traditional detectors fail when video quality drops or when new generative models emerge. SAGE combines high-level semantics with low-level pixel forensics to achieve 94.8% AUC.
          </p>
        </div>

        <div className={styles.cardsGrid}>
          {/* Card 1: DINOv2 */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Branch 1: DINOv2 Semantic Vision</h3>
            <p className={styles.featureDesc}>
              Leverages a frozen Vision Transformer (DINOv2-small) with 3D Depthwise Temporal Convolutions to detect unnatural eye blinks, facial distortions, and temporal flicker across 30 consecutive video frames.
            </p>
          </div>

          {/* Card 2: Bayar Conv */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Branch 2: Bayar Frequency Forensics</h3>
            <p className={styles.featureDesc}>
              A learnable 5x5 constrained high-pass convolution suppresses normal skin and lighting textures to reveal invisible upsampling artifacts, boundary seams, and generative noise fingerprints.
            </p>
          </div>

          {/* Card 3: Disagreement Gate */}
          <div className={styles.featureCard}>
            <div className={styles.featureIcon} style={{ background: "rgba(139, 92, 246, 0.15)", color: "#c084fc" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <h3 className={styles.featureTitle}>Disagreement Gating Fusion</h3>
            <p className={styles.featureDesc}>
              Computes feature agreement and difference vectors between semantic and forensic channels, adaptively learning a blending weight (α) to make robust predictions even against compressed videos.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION: FEATURES & BENCHMARKS */}
      <section id="features" className={styles.contentSection}>
        <div className={styles.sectionHeader}>
          <div className="pill-badge">Benchmark Highlights</div>
          <h2 className={styles.sectionTitle}>Engineered for Real-World Edge Latency</h2>
          <p className={styles.sectionSubtitle}>
            Trained on FaceForensics++ (7,000 videos, 1,028 primary person identities) with strict cross-identity separation.
          </p>
        </div>

        <div className={styles.cardsGrid}>
          <div className={styles.featureCard}>
            <h3 className={styles.featureTitle} style={{ color: "var(--accent-cyan)" }}>146.2 ms Latency</h3>
            <p className={styles.featureDesc}>
              Benchmarked on standard edge GPUs (Tesla T4) capable of processing ~6.84 full 30-frame videos per second in real time.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3 className={styles.featureTitle} style={{ color: "var(--accent-green-bright)" }}>Only 244K Trainable Params</h3>
            <p className={styles.featureDesc}>
              98.9% of parameters are frozen in the DINOv2 backbone, drastically reducing overfitting and enabling ultra-fast fine-tuning.
            </p>
          </div>
          <div className={styles.featureCard}>
            <h3 className={styles.featureTitle} style={{ color: "var(--accent-magenta)" }}>6 Manipulation Types</h3>
            <p className={styles.featureDesc}>
              Trained against Deepfakes, Face2Face, FaceSwap, FaceShifter, NeuralTextures, and DeepFakeDetection with 0.9535 F1 Score.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION: ABOUT */}
      <section id="about" className={styles.contentSection}>
        <div className={styles.sectionHeader}>
          <div className="pill-badge">Project Background</div>
          <h2 className={styles.sectionTitle}>About SAGE</h2>
          <p className={styles.sectionSubtitle}>
            Developed as an advanced machine learning mini-project exploring vision transformers and constrained forensic kernels to defend digital authenticity in media.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.logoArea}>
          <span className={styles.logoText} style={{ fontSize: "18px" }}>SAGE</span>
          <span>© 2026 AI-Powered Deepfake Detection</span>
        </div>
        <div>
          <span>FaceForensics++ MTCNN Evaluation • 30 Frames Sequence</span>
        </div>
      </footer>

      {/* INTERACTIVE VIDEO UPLOAD / SCANNER MODAL */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div className={styles.logoIconWrapper} style={{ width: "30px", height: "30px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L3 7V12C3 17.5 7 21.5 12 23C17 21.5 21 17.5 21 12V7L12 2Z" fill="url(#modalShield)" />
                    <defs>
                      <linearGradient id="modalShield" x1="3" y1="2" x2="21" y2="23">
                        <stop stopColor="#3b82f6" />
                        <stop offset="1" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#ffffff" }}>
                  SAGE Neural Video Analyzer
                </h3>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setIsModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Sample selection */}
              <div className={styles.sampleSelector}>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>Select a sample or drop a custom video:</span>
                <div className={styles.samplePills}>
                  <button
                    className={`${styles.sampleBtn} ${selectedSample === "deepfake" ? styles.sampleBtnActive : ""}`}
                    onClick={() => {
                      setSelectedSample("deepfake");
                      setAnalysisResult(null);
                    }}
                  >
                    <span>🔴 Sample Deepfake (FaceSwap)</span>
                  </button>
                  <button
                    className={`${styles.sampleBtn} ${selectedSample === "real" ? styles.sampleBtnActive : ""}`}
                    onClick={() => {
                      setSelectedSample("real");
                      setAnalysisResult(null);
                    }}
                  >
                    <span>🟢 Sample Real Video (Original)</span>
                  </button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                className={styles.uploadDropzone}
                onClick={() => runSimulatedInference(selectedSample)}
              >
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(139, 92, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#ffffff", fontWeight: "600", fontSize: "15px" }}>
                    {isAnalyzing ? "Processing 30 Video Frames..." : "Click to Analyze Selected Video"}
                  </p>
                  <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>
                    Supports MP4, MOV, WebM or sequences (MTCNN 224x224 crops)
                  </p>
                </div>
              </div>

              {/* Progress bar during analysis */}
              {isAnalyzing && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#94a3b8" }}>
                    <span>Pipeline: MTCNN ➔ DINOv2 Semantics ➔ Bayar Conv ➔ Gate</span>
                    <span>{analysisProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{ width: `${analysisProgress}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #a855f7, #f43f5e)", transition: "width 0.2s ease" }} />
                  </div>
                </div>
              )}

              {/* Analysis Results Display */}
              {analysisResult && (
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: analysisResult.label === "FAKE" ? "rgba(244, 63, 94, 0.12)" : "rgba(16, 185, 129, 0.12)",
                    border: `1px solid ${analysisResult.label === "FAKE" ? "#f43f5e" : "#10b981"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          fontWeight: "800",
                          fontFamily: "var(--font-display)",
                          fontSize: "14px",
                          background: analysisResult.label === "FAKE" ? "#f43f5e" : "#10b981",
                          color: "#ffffff",
                        }}
                      >
                        {analysisResult.label}
                      </span>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "#ffffff" }}>
                        Confidence: {analysisResult.confidence}
                      </span>
                    </div>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                      Latency: <strong style={{ color: "#ffffff" }}>{analysisResult.latency}</strong>
                    </span>
                  </div>

                  <p style={{ fontSize: "13.5px", color: "#cbd5e1", lineHeight: "1.5" }}>
                    {analysisResult.details}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", paddingTop: "8px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Semantic Score</span>
                      <div style={{ fontWeight: "700", color: "#38bdf8" }}>{analysisResult.semanticScore}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Forensic Artifacts</span>
                      <div style={{ fontWeight: "700", color: "#f43f5e" }}>{analysisResult.forensicNoise}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>Gating Blending (α)</span>
                      <div style={{ fontWeight: "700", color: "#c084fc" }}>{analysisResult.gateAlpha}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
