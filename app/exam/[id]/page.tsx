"use client";

import Image from "next/image";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore, useExamStore } from "@/store";
import { supabase } from "@/lib/supabase";
import { dbSync } from "@/lib/dbSync";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, ShieldCheck, Video, VideoOff, Sparkles, Laptop, Fingerprint, UserCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ExamScreen() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const { cheatingScore, warnings, addWarning, resetExamState, isExamActive, setExamActive } = useExamStore();
  
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraActive, setCameraActive] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showBigAlert, setShowBigAlert] = useState<any>(null);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  // Load saved progress from localStorage if it exists on mount
  useEffect(() => {
    if (!user || !params.id) return;
    const progressKey = `exam_progress_${user.id}_${params.id}`;
    const saved = localStorage.getItem(progressKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          setCurrentQuestion(parsed.currentQuestion ?? 0);
          setSelectedAnswers(parsed.selectedAnswers ?? {});
          setTimeLeft(parsed.timeLeft ?? (60 * 60));
          setHasSavedProgress(true);
          console.log("Automatically restored previous exam progress from reload!", parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved exam progress:", e);
      }
    }
  }, [user, params.id]);

  // Save current progress on changes
  useEffect(() => {
    if (!examStarted || !user || !params.id) return;
    const progressKey = `exam_progress_${user.id}_${params.id}`;
    localStorage.setItem(progressKey, JSON.stringify({
      currentQuestion,
      selectedAnswers,
      timeLeft,
      examStarted: true
    }));
  }, [currentQuestion, selectedAnswers, timeLeft, examStarted, user, params.id]);
  
  const webcamRef1 = useRef<Webcam>(null);
  const webcamRef2 = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId1, setSelectedCameraId1] = useState<string>("");
  const [selectedCameraId2, setSelectedCameraId2] = useState<string>("");
  const [lastAnalysis, setLastAnalysis] = useState<any>(null);

  // Camera detection
  useEffect(() => {
    const detectCameras = async () => {
      try {
        // Request user permission stream first to unlock labels in browsers
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
        initialStream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === "videoinput");
        setVideoDevices(videoInputs);
        
        if (videoInputs.length > 0) {
          setSelectedCameraId1(videoInputs[0].deviceId);
          if (videoInputs.length > 1) {
            setSelectedCameraId2(videoInputs[1].deviceId);
          } else {
            setSelectedCameraId2("simulated"); // Default to virtual side camera if single device is found
          }
        }
      } catch (err) {
        console.warn("Failed to enumerate media devices or user denied camera permissions", err);
      }
    };

    if (cameraActive) {
      detectCameras();
    }
  }, [cameraActive]);

  // Watch for new warnings to show big alert
  useEffect(() => {
    if (warnings.length > 0) {
      setShowBigAlert(warnings[0]);
    }
  }, [warnings]);

  const defaultQuestions = [
    { id: 1, text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correct_option: 1 },
    { id: 2, text: "Which data structure uses LIFO?", options: ["Queue", "Tree", "Stack", "Graph"], correct_option: 2 },
    { id: 3, text: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"], correct_option: 0 },
    { id: 4, text: "Which of the following is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correct_option: 2 },
  ];

  const [questions, setQuestions] = useState<any[]>(defaultQuestions);

  // Load custom student assigned questions if available
  useEffect(() => {
    const loadCustomQuestions = async () => {
      if (user && params.id) {
        try {
          const customQs = await dbSync.getAssignedQuestions(user.id, params.id as string);
          if (customQs && customQs.length > 0) {
            console.log("Loaded custom assigned questions for student:", customQs);
            const formatted = customQs.map((q, idx) => ({
              id: q.id || idx + 1,
              text: q.question_text,
              options: q.options,
              correct_option: q.correct_option
            }));
            setQuestions(formatted);
          } else {
            setQuestions(defaultQuestions);
          }
        } catch (err) {
          console.warn("Failed to load assigned questions from DB sync layer, using defaults", err);
          setQuestions(defaultQuestions);
        }
      }
    };
    loadCustomQuestions();
  }, [user, params.id]);

  // Initialize exam
  useEffect(() => {
    if (!user || user.role !== "student") {
      router.push("/");
      return;
    }
    resetExamState();
  }, [user, router, resetExamState]);

  // Fullscreen and Tab Switch Detection
  useEffect(() => {
    if (!examStarted) return;

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && isExamActive) {
        addWarning("Exited fullscreen mode", "high");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && isExamActive) {
        addWarning("Tab switched or minimized", "critical");
      }
    };

    const handleBlur = () => {
      if (isExamActive) {
        addWarning("Lost window focus", "medium");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [examStarted, isExamActive, addWarning]);

  // Timer
  useEffect(() => {
    if (!examStarted || !isExamActive || showBigAlert || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [examStarted, isExamActive, showBigAlert, timeLeft]);

  // Auto-submit on high cheating score
  useEffect(() => {
    if (cheatingScore >= 100 && isExamActive) {
      setExamActive(false);
      if (user && params.id) {
        localStorage.removeItem(`exam_progress_${user.id}_${params.id}`);
      }
      alert("Exam terminated due to excessive violations.");
      router.push("/dashboard");
    }
  }, [cheatingScore, isExamActive, setExamActive, router, user, params.id]);

  // Save violation details to Supabase database with screenshots
  const saveViolation = useCallback(async (type: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical', screenshot: string) => {
    try {
      const sessionId = params.id as string;
      if (!sessionId) return;

      console.log(`Saving violation to DB: ${type} - ${description} (${severity})`);
      
      const { error: insertError } = await supabase
        .from('violations')
        .insert({
          session_id: sessionId,
          violation_type: type,
          description: description,
          severity: severity,
          screenshot: screenshot,
          video_timestamp_seconds: Math.max(0, Math.floor((3600 - timeLeft)))
        });
      
      if (insertError) throw insertError;

      // Update the session cheating score
      let scoreIncrease = 0;
      switch (severity) {
        case 'low': scoreIncrease = 5; break;
        case 'medium': scoreIncrease = 15; break;
        case 'high': scoreIncrease = 30; break;
        case 'critical': scoreIncrease = 50; break;
      }

      const { data: sessionData, error: sessionFetchError } = await supabase
        .from('exam_sessions')
        .select('cheating_score')
        .eq('id', sessionId)
        .maybeSingle();

      if (!sessionFetchError && sessionData) {
        const currentScore = sessionData.cheating_score || 0;
        const newScore = Math.min(100, currentScore + scoreIncrease);
        await supabase
          .from('exam_sessions')
          .update({ cheating_score: newScore })
          .eq('id', sessionId);
      }
    } catch (err) {
      console.error("Failed to save violation to Supabase:", err);
    }
  }, [params.id, timeLeft]);

  // Process live detector results
  const processProctoringAnalysis = useCallback(async (analysis: any, screenshot: string) => {
    if (!analysis) return;
    setLastAnalysis(analysis);

    const faces_detected = typeof analysis.faces_detected !== "undefined" ? analysis.faces_detected : 1;
    const head_movement = analysis.head_movement || "normal";
    const student_recognized = typeof analysis.student_recognized !== "undefined" ? analysis.student_recognized : true;

    let violationFound = false;
    let type = "";
    let desc = "";
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // 1. Check for no face detected / face is too dark/not visible in frame (high) - Prioritized first for precise detection
    if (faces_detected === 0) {
      type = "no_face";
      desc = "No face detected or face is in dark. Please reposition yourself clearly or turn on a light to be recognized.";
      severity = "high";
      violationFound = true;
    }
    // 2. Check for multiple faces (critical) - Prioritized second
    else if (faces_detected > 1) {
      type = "multiple_faces";
      desc = "Multiple faces detected. Only the authorized student is permitted in frame.";
      severity = "critical";
      violationFound = true;
    }
    // 3. Check for student identity mismatch (critical)
    else if (!student_recognized) {
      type = "identity_mismatch";
      desc = "Candidate identity mismatch: face in feed does not match the registered user.";
      severity = "critical";
      violationFound = true;
    }
    // 4. Check for suspicious head movement/looking away (medium)
    else if (head_movement !== "normal" && head_movement !== "") {
      type = "head_movement";
      desc = `Suspicious head movement: looking ${head_movement.replace('looking_', '')}. Keep your gaze on the screen.`;
      severity = "medium";
      violationFound = true;
    }
    // 5. Check for excessive physical or structural shifting (high)
    else if (analysis.excessive_movement === true) {
      type = "excessive_movement";
      desc = "Excessive head, shoulder, or body shifting detected. Please sit still and stay focused.";
      severity = "high";
      violationFound = true;
    }

    if (violationFound) {
      addWarning(desc, severity);
      setShowBigAlert({ message: desc, severity });
      await saveViolation(type, desc, severity, screenshot);
    } else {
      setShowBigAlert(null);
    }

    // Process any other custom environmental/device warnings produced by Gemini analysis
    if (analysis.warnings && Array.isArray(analysis.warnings)) {
      for (const warn of analysis.warnings) {
        if (!warn) continue;
        addWarning(warn, "high");
        if (!violationFound) {
          setShowBigAlert({ message: warn, severity: 'high' });
        }
        await saveViolation("unpermitted_materials", warn, "high", screenshot);
      }
    }
  }, [addWarning, saveViolation]);

  // Real-Time AI Proctoring Loop (every 3 seconds)
  useEffect(() => {
    if (!examStarted || !isExamActive || !cameraActive) return;

    let isProcessing = false;

    const runAIProctoring = async () => {
      // Avoid overlapping requests
      if (isProcessing) return;
      isProcessing = true;

      try {
        if (!webcamRef1.current) {
          isProcessing = false;
          return;
        }

        const screenshot1 = webcamRef1.current.getScreenshot();
        if (!screenshot1) {
          isProcessing = false;
          return;
        }

        let screenshot2 = null;
        if (selectedCameraId2 === "simulated") {
          screenshot2 = "https://picsum.photos/seed/deskview/400/300";
        } else if (webcamRef2.current) {
          screenshot2 = webcamRef2.current.getScreenshot();
        }

        // Pack both camera angles into a composite evidence JSON payload
        const compositeScreenshot = JSON.stringify({
          primary: screenshot1,
          secondary: screenshot2
        });

        // Call the server-side API proxy for multimodal dual-camera analysis
        const response = await fetch("/api/proctor/detect", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: screenshot1, image2: screenshot2 }),
        });

        if (response.ok) {
          const analysisResult = await response.json();
          await processProctoringAnalysis(analysisResult, compositeScreenshot);
        }
      } catch (err) {
        console.error("Proctoring agent execution error:", err);
      } finally {
        isProcessing = false;
      }
    };

    // Fast check every 3 seconds for immediate environmental feedback
    const proctorInterval = setInterval(runAIProctoring, 3000);

    // Instant mouse leave detection
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
        const desc = "Mouse cursor left the exam window.";
        const screenshot1 = webcamRef1.current?.getScreenshot() || "";
        let screenshot2 = null;
        if (selectedCameraId2 === "simulated") {
          screenshot2 = "https://picsum.photos/seed/deskview/400/300";
        } else if (webcamRef2.current) {
          screenshot2 = webcamRef2.current.getScreenshot();
        }

        const compositeScreenshot = JSON.stringify({
          primary: screenshot1,
          secondary: screenshot2
        });

        addWarning(desc, "high");
        saveViolation("tab_switch", desc, "high", compositeScreenshot);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearInterval(proctorInterval);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [examStarted, isExamActive, cameraActive, selectedCameraId2, addWarning, processProctoringAnalysis, saveViolation]);

  const startExam = async () => {
    try {
      if (containerRef.current) {
        await containerRef.current.requestFullscreen();
      }

      // Upsert the user session for this specific exam into Supabase
      if (user) {
        const examId = params.id as string;
        const { data: existingSession } = await supabase
          .from('exam_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('exam_id', examId)
          .maybeSingle();

        let sessionId = existingSession?.id;

        if (!sessionId) {
          const { data: newSession } = await supabase
            .from('exam_sessions')
            .insert({
              user_id: user.id,
              exam_id: examId,
              status: 'in_progress',
              started_at: new Date().toISOString(),
              cheating_score: 0
            })
            .select('id')
            .single();
          
          if (newSession) {
            sessionId = newSession.id;
          }
        } else {
          await supabase
            .from('exam_sessions')
            .update({
              status: 'in_progress',
              started_at: new Date().toISOString(),
              cheating_score: 0
            })
            .eq('id', sessionId);
        }
      }

      setExamStarted(true);
      setExamActive(true);
      setCameraActive(true);
    } catch (err) {
      console.warn("Fullscreen permission or Supabase sync error, starting sandbox exam", err);
      // Perfect offline-fallback fallback
      setExamStarted(true);
      setExamActive(true);
      setCameraActive(true);
    }
  };

  const submitExam = async () => {
    setExamActive(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    if (user && params.id) {
      const progressKey = `exam_progress_${user.id}_${params.id}`;
      localStorage.removeItem(progressKey);
    }

    try {
      if (user) {
        const examId = params.id as string;

        // Calculate dynamic results & score
        let correctCount = 0;
        const mappedAnswers = questions.map((q, idx) => {
          const selected = selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : null;
          const isCorrect = selected !== null && selected === (q.correct_option ?? 0);
          if (isCorrect) correctCount++;
          return {
            question_text: q.text,
            options: q.options,
            correct_option: q.correct_option ?? 0,
            selected_option: selected,
          };
        });

        const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 100;

        // Save progress, answers, and score in db sync layer
        await dbSync.saveAnswersAndResult(
          examId, // using examId as key for matching path params.id inside session review page
          user.id,
          examId,
          mappedAnswers,
          score
        );

        await supabase
          .from('exam_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('exam_id', examId);
      }
    } catch (err) {
      console.error("Failed to mark exam as completed in Supabase:", err);
    }

    router.push("/dashboard");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!examStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent p-4" ref={containerRef}>
        <Card className="w-full max-w-3xl border-white/20 bg-white/95 backdrop-blur-md shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldCheck className="text-blue-600" />
              Twin Webcam Pre-Check Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasSavedProgress && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs sm:text-sm text-emerald-800 flex items-start gap-3 shadow-3xs">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h4 className="font-bold text-emerald-900 mb-1">
                    Saved Exam Progress Detected!
                  </h4>
                  <p className="opacity-90 leading-relaxed font-medium">
                    We found active exam progress from your previous window or session. 
                    Upon confirming your cameras, you will resume exactly at <strong>Question {currentQuestion + 1}</strong> with your options selection and <strong>{formatTime(timeLeft)}</strong> of remaining time fully intact.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs sm:text-sm text-blue-850">
              <h4 className="font-bold mb-2 flex items-center gap-2 text-blue-900">
                <AlertTriangle className="w-4 h-4 text-blue-700" />
                Dual camera security activated:
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 opacity-90">
                <li>Configure <strong>Front Camera</strong> to screen facial center.</li>
                <li>Configure <strong>Side Camera</strong> (e.g. secondary external webcam or phone angle) to overlay environmental surrounding Desk area.</li>
                <li>Remain in high-contrast view with no screens, secondary aids, or partners detected.</li>
              </ul>
            </div>
            
            {cameraActive && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">📷 Camera 1: Primary Face Camera</label>
                  <select 
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg p-2.5 outline-none hover:border-slate-300 transition-colors"
                    value={selectedCameraId1}
                    onChange={(e) => setSelectedCameraId1(e.target.value)}
                  >
                    {videoDevices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                    {videoDevices.length === 0 && <option value="">Searching for cameras...</option>}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">📹 Camera 2: Side Environment Camera</label>
                  <select 
                    className="w-full text-xs sm:text-sm bg-white border border-slate-200 rounded-lg p-2.5 outline-none hover:border-slate-300 transition-colors"
                    value={selectedCameraId2}
                    onChange={(e) => setSelectedCameraId2(e.target.value)}
                  >
                    <option value="">-- Select Secondary Camera --</option>
                    {videoDevices.map((device, idx) => (
                      <option key={device.deviceId} value={device.deviceId} disabled={device.deviceId === selectedCameraId1}>
                        {device.label || `Camera ${idx + 1}`} {device.deviceId === selectedCameraId1 ? "(In Use)" : ""}
                      </option>
                    ))}
                    <option value="simulated">🔄 Virtual Simulated Desk Camera (Continuous Room Feed)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Box 1 */}
              <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl p-3 h-52 relative overflow-hidden border border-slate-200/50 shadow-sm">
                {cameraActive && selectedCameraId1 ? (
                  <Webcam
                    audio={false}
                    ref={webcamRef1}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ deviceId: { exact: selectedCameraId1 } }}
                    className="w-full h-full object-cover rounded-lg"
                    mirrored
                  />
                ) : (
                  <div className="text-center text-slate-400">
                    <Video className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-blue-500" />
                    <p className="text-xs font-semibold">Primary Cam Inactive</p>
                    <Button variant="outline" size="sm" className="mt-3 text-slate-900 border-slate-600 bg-white" onClick={() => setCameraActive(true)}>
                      Request Access
                    </Button>
                  </div>
                )}
                {cameraActive && (
                  <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    📷 Camera 1 (Front Face)
                  </div>
                )}
              </div>

              {/* Box 2 */}
              <div className="flex flex-col items-center justify-center bg-slate-900 rounded-xl p-3 h-52 relative overflow-hidden border border-slate-200/50 shadow-sm">
                {cameraActive && selectedCameraId2 === "simulated" ? (
                  <div className="relative w-full h-full rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center">
                    <img 
                      src="https://picsum.photos/seed/deskview/400/300"
                      alt="Simulated desk view"
                      className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded font-mono font-bold animate-pulse uppercase tracking-wider">
                      ✨ Active Simulated Feed
                    </div>
                  </div>
                ) : cameraActive && selectedCameraId2 ? (
                  <Webcam
                    audio={false}
                    ref={webcamRef2}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ deviceId: { exact: selectedCameraId2 } }}
                    className="w-full h-full object-cover rounded-lg"
                    mirrored
                  />
                ) : (
                  <div className="text-center text-slate-400 p-4">
                    <Video className="w-8 h-8 mx-auto mb-1.5 opacity-40 text-blue-500" />
                    <p className="text-xs font-semibold">Secondary Cam Inactive</p>
                    {cameraActive && (
                      <p className="text-[10px] opacity-60 max-w-[200px] mt-1 text-slate-500">
                        Please connect a secondary camera, or choose &quot;Virtual Simulated Desk Camera&quot; above to test the proctoring.
                      </p>
                    )}
                  </div>
                )}
                {cameraActive && (
                  <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    📹 Camera 2 (Side Desk)
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <div className="p-6 pt-0 flex flex-col sm:flex-row items-center justify-between gap-4">
            {hasSavedProgress && (
              <span className="text-xs text-slate-500 italic font-medium">
                Detected progress: {Object.keys(selectedAnswers).length} questions answered
              </span>
            )}
            <Button size="lg" onClick={startExam} disabled={!cameraActive || !selectedCameraId1 || !selectedCameraId2} className={hasSavedProgress ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
              {hasSavedProgress ? "Restore Progress & Resume Exam" : "Confirm Inputs & Start Exam"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col" ref={containerRef}>
      {/* Top Navigation Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <div>
            <h1 className="text-lg font-semibold text-slate-800 leading-tight">Advanced Mathematics</h1>
            <p className="text-xs text-slate-500">Candidate: {user?.fullName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full font-mono text-lg font-semibold text-slate-700">
            <Clock className="w-5 h-5 text-blue-600" />
            {formatTime(timeLeft)}
          </div>
          <Button variant="destructive" onClick={() => setShowSubmitModal(true)}>
            Finish Exam
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left/Center: Question Panel */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto w-full">
          {/* Mobile Floating Dual-PIP Camera */}
          {cameraActive && (
            <div className="md:hidden fixed top-[74px] right-4 w-28 h-44 bg-black rounded-xl shadow-2xl border border-slate-300/40 z-40 overflow-hidden flex flex-col pointer-events-none">
              <div className="relative flex-1 aspect-video">
                <Webcam audio={false} videoConstraints={selectedCameraId1 ? { deviceId: { exact: selectedCameraId1 } } : undefined} className="w-full h-full object-cover" mirrored />
                <span className="absolute bottom-1 left-1 bg-black/60 text-[7px] text-white px-1 rounded">CAM 1</span>
              </div>
              <div className="relative flex-1 aspect-video border-t border-slate-800">
                {selectedCameraId2 === "simulated" ? (
                  <img src="https://picsum.photos/seed/deskview/200/150" alt="Simulated desk view" className="w-full h-full object-cover opacity-50" />
                ) : (
                  <Webcam audio={false} videoConstraints={selectedCameraId2 ? { deviceId: { exact: selectedCameraId2 } } : undefined} className="w-full h-full object-cover" mirrored />
                )}
                <span className="absolute bottom-1 left-1 bg-black/60 text-[7px] text-white px-1 rounded">CAM 2</span>
              </div>
            </div>
          )}
          
          <div className="max-w-3xl mx-auto pb-40 md:pb-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-medium text-slate-700">
                Question {currentQuestion + 1} of {questions.length}
              </h2>
              <div className="flex gap-1">
                {questions.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${
                      currentQuestion === idx
                        ? "bg-blue-600 text-white"
                        : selectedAnswers[idx] !== undefined
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-white border text-slate-500 hover:bg-slate-50"
                    }`}
                    onClick={() => setCurrentQuestion(idx)}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
            </div>

            <Card className="mb-6 shadow-sm border-slate-200">
              <CardContent className="p-8">
                <h3 className="text-2xl font-medium text-slate-900 mb-8 leading-relaxed">
                  {questions[currentQuestion].text}
                </h3>
                
                <div className="space-y-3">
                  {questions[currentQuestion].options.map((option: string, idx: number) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-center gap-3 ${
                        selectedAnswers[currentQuestion] === idx
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedAnswers({ ...selectedAnswers, [currentQuestion]: idx })}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        selectedAnswers[currentQuestion] === idx ? "border-blue-600" : "border-slate-300"
                      }`}>
                        {selectedAnswers[currentQuestion] === idx && (
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <span className="text-lg text-slate-700">{option}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                disabled={currentQuestion === 0}
              >
                Previous
              </Button>
              {currentQuestion === questions.length - 1 ? (
                <Button size="lg" onClick={() => setShowSubmitModal(true)}>
                  Review & Submit
                </Button>
              ) : (
                <Button size="lg" onClick={() => setCurrentQuestion(Math.min(questions.length - 1, currentQuestion + 1))}>
                  Next Question
                </Button>
              )}
            </div>
          </div>
        </main>

        {/* Right: Proctoring Status Panel */}
        <aside className="hidden md:flex w-80 bg-white border-l flex-col shadow-[-4px_0_15px_rgba(0,0,0,0.03)] z-10 relative">
          {/* Webcam Feeds */}
          <div className="p-4 border-b bg-slate-50 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Dual Streams</h4>
            
            {/* Front/Face Cam */}
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner border border-slate-200">
              {cameraActive && selectedCameraId1 ? (
                <Webcam
                  audio={false}
                  ref={webcamRef1}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ deviceId: { exact: selectedCameraId1 } }}
                  className="w-full h-full object-cover"
                  mirrored
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <VideoOff className="w-8 h-8" />
                </div>
              )}
              {cameraActive && cheatingScore < 80 && (
                <div className="absolute inset-0 border-2 border-emerald-500/50 opacity-45 m-3 rounded-sm pointer-events-none" />
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded flex items-center gap-1 font-semibold tracking-wider uppercase select-none">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CAM 1 (FACE)
              </div>
            </div>

            {/* Side/Environment Cam */}
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner border border-slate-200">
              {cameraActive && selectedCameraId2 === "simulated" ? (
                <div className="relative w-full h-full bg-slate-950 flex items-center justify-center">
                  <img 
                    src="https://picsum.photos/seed/deskview/400/300"
                    alt="Simulated desk view"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity"
                  />
                  <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-500 text-[8px] px-1.5 py-0.5 rounded font-mono font-bold animate-pulse">
                    SIMULATED
                  </div>
                </div>
              ) : cameraActive && selectedCameraId2 ? (
                <Webcam
                  audio={false}
                  ref={webcamRef2}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ deviceId: { exact: selectedCameraId2 } }}
                  className="w-full h-full object-cover"
                  mirrored
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <VideoOff className="w-8 h-8" />
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] px-2 py-0.5 rounded flex items-center gap-1 font-semibold tracking-wider uppercase select-none">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                CAM 2 (SIDE)
              </div>
            </div>
          </div>

          {/* Real-time CV Detection Telemetry */}
          {cameraActive && (
            <div className="mx-4 mt-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 shadow-sm space-y-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-spin animate-duration-3000" />
                <span>Real-Time CV Telemetry</span>
              </div>
              
              {/* Candidate Verification */}
              <div className="flex flex-col gap-1 border-b border-dashed border-slate-200 pb-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Candidate Identity Match</span>
                {lastAnalysis ? (
                  lastAnalysis.student_recognized ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-medium">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Verified: Shivam Raj recognized</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-medium animate-pulse">
                      <Fingerprint className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span className="truncate">Identity Mismatch: Shivam Raj missing</span>
                    </div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-400 italic">Matching candidate identity...</div>
                )}
              </div>

              {/* Hand Objects */}
              <div className="flex flex-col gap-1 border-b border-dashed border-slate-200 pb-2">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Objects in Hands</span>
                {lastAnalysis ? (
                  lastAnalysis.hand_objects && lastAnalysis.hand_objects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {lastAnalysis.hand_objects.map((obj: string, i: number) => {
                        const isSus = ["phone", "smartphone", "mobile", "cheat", "book"].some(word => obj.toLowerCase().includes(word));
                        return (
                          <span key={i} className={`text-[9px] font-mono font-medium px-2 py-0.5 rounded border ${isSus ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-600'}`}>
                            {obj}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-emerald-600 bg-emerald-50/40 px-2 py-0.5 rounded border border-emerald-100/50 font-medium">✨ Hands empty / holding pen</div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-400 italic">Scanning hand motions...</div>
                )}
              </div>

              {/* Desk Objects */}
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Desk / Workspace Items</span>
                {lastAnalysis ? (
                  lastAnalysis.desk_objects && lastAnalysis.desk_objects.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {lastAnalysis.desk_objects.map((obj: string, i: number) => {
                        const isSus = ["phone", "smartphone", "mobile", "cheat", "book"].some(word => obj.toLowerCase().includes(word));
                        return (
                          <span key={i} className={`text-[9px] font-mono font-medium px-1.5 py-0.5 rounded border ${isSus ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse' : 'bg-blue-50/45 border-blue-100 text-blue-700'}`}>
                            {obj}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Workspace clear</div>
                  )
                ) : (
                  <div className="text-[10px] text-slate-400 italic">Analyzing desk items...</div>
                )}
              </div>
            </div>
          )}

          {/* Proctoring Status */}
          <div className="p-5 flex-1 flex flex-col gap-6 overflow-y-auto">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">System Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <Video className="w-4 h-4" /> Camera
                  </span>
                  {cameraActive ? (
                    <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Active</span>
                  ) : (
                    <span className="text-red-600 font-medium">Inactive</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="w-4 h-4" /> AI Proctoring
                  </span>
                  <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Active</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <ShieldAlert className="w-4 h-4" /> Fullscreen Lock
                  </span>
                  {isFullscreen ? (
                    <span className="text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Active</span>
                  ) : (
                    <span className="text-red-600 font-medium">Violated</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="flex justify-between items-end mb-2">
                <h3 className="text-sm font-bold text-slate-700">Trust Score</h3>
                <span className={`text-lg font-bold ${
                  cheatingScore < 30 ? "text-emerald-600" : 
                  cheatingScore < 70 ? "text-amber-500" : "text-red-600"
                }`}>
                  {100 - cheatingScore}%
                </span>
              </div>
              <Progress value={100 - cheatingScore} className={`h-2 ${
                cheatingScore < 30 ? "[&>div]:bg-emerald-500" : 
                cheatingScore < 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
              }`} />
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Score decreases upon detecting suspicious activities. Exam terminates at 0%.
              </p>
            </div>

            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Alerts</h3>
              <div className="space-y-2">
                <AnimatePresence>
                  {warnings.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 text-center py-4 italic">
                      No suspicious activity detected.
                    </motion.div>
                  ) : (
                    warnings.map((warning) => (
                      <motion.div
                        key={warning.id}
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={`border text-xs p-3 rounded-lg flex flex-col gap-1 shadow-sm ${
                          warning.severity === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                          warning.severity === 'high' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                          'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                            warning.severity === 'critical' ? 'text-red-500' :
                            warning.severity === 'high' ? 'text-orange-500' : 'text-amber-500'
                          }`} />
                          <span className="font-medium leading-tight flex-1">{warning.message}</span>
                        </div>
                        <span className="text-[10px] opacity-70 ml-6 font-mono">
                          {new Date(warning.timestamp).toLocaleTimeString()}
                        </span>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Submit Modal Overlay */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader>
              <CardTitle>Submit Exam?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                You have answered {Object.keys(selectedAnswers).length} out of {questions.length} questions.
                Are you sure you want to submit? This action cannot be undone.
              </p>
            </CardContent>
            <div className="p-6 pt-0 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
              <Button onClick={submitExam}>Confirm Submission</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Big Warning Alert Overlay */}
      <AnimatePresence>
        {showBigAlert && (
          <motion.div
            initial={{ opacity: 0, y: 150 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 150 }}
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
          >
            {/* Blocker container - center card on desktop, bottom sheet on mobile */}
            <div className="bg-white border-t-4 md:border-4 border-red-500 rounded-t-2xl md:rounded-2xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative flex flex-col items-center text-center pb-12 md:pb-8">
              <div className="w-12 h-12 md:w-20 md:h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 md:mb-6 animate-pulse animate-duration-1000">
                <AlertTriangle className="w-6 h-6 md:w-10 md:h-10 text-red-600" />
              </div>
              <h2 className="text-xl md:text-3xl font-bold text-slate-900 mb-2">Exam Paused: Rule Violation</h2>
              <p className="text-base md:text-xl text-red-600 font-semibold mb-6">{showBigAlert.message}</p>
              <div className="bg-slate-100 p-4 md:p-6 rounded-lg w-full mb-6 relative overflow-hidden text-left">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
                <p className="text-slate-600 font-medium text-xs md:text-base leading-relaxed">
                  The exam is temporarily paused and locked. Correct your environment (e.g. adjust camera, ensure you are alone, focus on screen), and this alert will automatically disappear to let you continue.
                </p>
              </div>
              {/* Real-time monitoring status indicators instead of manual bypass, forcing actual resolution */}
              <div className="w-full flex flex-col items-center justify-center gap-2 mt-2">
                <div className="text-sm font-semibold text-red-600 animate-pulse flex items-center justify-center gap-2 bg-red-50 px-5 py-2.5 rounded-full border border-red-100">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  Monitoring camera feeds for auto-resolution...
                </div>
                <p className="text-xs text-slate-500 mt-2 font-medium leading-relaxed max-w-sm">
                  Please reposition yourself, ensure proper lighting, remove any extra persons, and keep your eyes on the screen to auto-dismiss this lock.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
