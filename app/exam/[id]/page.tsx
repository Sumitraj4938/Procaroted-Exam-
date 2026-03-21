"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore, useExamStore } from "@/store";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, ShieldCheck, Video, VideoOff } from "lucide-react";
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
  const [cameraActive, setCameraActive] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showBigAlert, setShowBigAlert] = useState<any>(null);
  
  const webcamRef = useRef<Webcam>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Watch for new warnings to show big alert
  useEffect(() => {
    if (warnings.length > 0) {
      setShowBigAlert(warnings[0]);
      const timer = setTimeout(() => setShowBigAlert(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [warnings]);

  const questions = [
    { id: 1, text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"] },
    { id: 2, text: "Which data structure uses LIFO?", options: ["Queue", "Tree", "Stack", "Graph"] },
    { id: 3, text: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"] },
    { id: 4, text: "Which of the following is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"] },
  ];

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
    if (!examStarted || !isExamActive || timeLeft <= 0) return;
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [examStarted, isExamActive, timeLeft]);

  // Auto-submit on high cheating score
  useEffect(() => {
    if (cheatingScore >= 100 && isExamActive) {
      setExamActive(false);
      alert("Exam terminated due to excessive violations.");
      router.push("/dashboard");
    }
  }, [cheatingScore, isExamActive, setExamActive, router]);

  // Mock AI Proctoring Service
  useEffect(() => {
    if (!examStarted || !isExamActive || !cameraActive) return;

    // Fast detection interval (every 1 second instead of 5)
    const proctorInterval = setInterval(() => {
      // Simulate random AI detections for demo purposes
      const rand = Math.random();
      if (rand > 0.98) {
        addWarning("Head movement detected (looking away)", "medium");
      } else if (rand > 0.99) {
        addWarning("Multiple faces detected", "critical");
      } else if (rand > 0.995) {
        addWarning("No face detected", "high");
      }
    }, 1000);

    // Instant mouse leave detection
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 || e.clientX <= 0 || (e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
        addWarning("Mouse cursor left the exam window", "high");
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      clearInterval(proctorInterval);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [examStarted, isExamActive, cameraActive, addWarning]);

  const startExam = async () => {
    try {
      if (containerRef.current) {
        await containerRef.current.requestFullscreen();
      }
      setExamStarted(true);
      setExamActive(true);
      setCameraActive(true);
    } catch (err) {
      alert("Failed to enter fullscreen. Please allow fullscreen to start the exam.");
    }
  };

  const submitExam = () => {
    setExamActive(false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" ref={containerRef}>
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldCheck className="text-blue-600" />
              Exam Pre-Check
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <h4 className="font-semibold mb-2">Strict Proctoring Rules:</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>You must remain in fullscreen mode.</li>
                <li>Do not switch tabs or minimize the browser.</li>
                <li>Ensure your face is clearly visible at all times.</li>
                <li>No other persons are allowed in the frame.</li>
                <li>Excessive head movement will be flagged.</li>
              </ul>
            </div>
            
            <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg p-4 h-64 relative overflow-hidden">
              {cameraActive ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  className="w-full h-full object-cover rounded-md"
                  mirrored
                />
              ) : (
                <div className="text-center text-slate-500">
                  <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Camera access required</p>
                  <Button variant="outline" className="mt-4" onClick={() => setCameraActive(true)}>
                    Enable Camera
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
          <div className="p-6 pt-0 flex justify-end">
            <Button size="lg" onClick={startExam} disabled={!cameraActive}>
              I Understand, Start Exam
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col" ref={containerRef}>
      {/* Top Navigation Bar */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 w-8 h-8 rounded-md flex items-center justify-center text-white font-bold">
            AI
          </div>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center: Question Panel */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
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
                  {questions[currentQuestion].options.map((option, idx) => (
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
        <aside className="w-80 bg-white border-l flex flex-col shadow-[-4px_0_15px_rgba(0,0,0,0.03)] z-10">
          {/* Webcam Feed */}
          <div className="p-4 border-b bg-slate-50">
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video shadow-inner border border-slate-200">
              {cameraActive ? (
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  className="w-full h-full object-cover"
                  mirrored
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                  <VideoOff className="w-8 h-8" />
                </div>
              )}
              {/* Face Detection Overlay Box (Simulated) */}
              {cameraActive && cheatingScore < 80 && (
                <div className="absolute inset-0 border-2 border-emerald-500 opacity-50 m-4 rounded-sm pointer-events-none" />
              )}
              
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded flex items-center gap-1 font-medium tracking-wider uppercase">
                <div className={`w-1.5 h-1.5 rounded-full ${cameraActive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                LIVE
              </div>
            </div>
          </div>

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
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none p-6"
          >
            <div className="absolute inset-0 bg-red-900/20 backdrop-blur-sm" />
            <div className="bg-white border-4 border-red-500 rounded-2xl p-8 max-w-2xl w-full shadow-2xl relative flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Rule Violation Detected</h2>
              <p className="text-xl text-red-600 font-medium mb-6">{showBigAlert.message}</p>
              <div className="bg-slate-100 p-4 rounded-lg w-full">
                <p className="text-slate-600 font-medium">
                  Please correct this immediately to avoid exam termination.
                </p>
                <div className="mt-4 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "100%" }} 
                    animate={{ width: "0%" }} 
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-full bg-red-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
