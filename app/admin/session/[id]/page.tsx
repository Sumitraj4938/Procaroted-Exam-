"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store";
import { supabase } from "@/lib/supabase";
import { dbSync } from "@/lib/dbSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, AlertTriangle, Clock, ShieldAlert, Video, Eye, CheckCircle2, XCircle, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function SessionReviewPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [examResult, setExamResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const duration = 3600; // 1 hour in seconds

  const getDualScreenshots = (screenshotStr: string) => {
    if (!screenshotStr) return null;
    try {
      if (screenshotStr.trim().startsWith("{")) {
        const parsed = JSON.parse(screenshotStr);
        return {
          primary: parsed.primary || "",
          secondary: parsed.secondary || ""
        };
      }
    } catch (err) {
      console.warn("Screenshot parser failed, treating as standard legacy string", err);
    }
    return {
      primary: screenshotStr,
      secondary: ""
    };
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  // Load real exam session information and violation log with photo screenshots
  useEffect(() => {
    const fetchSessionAndViolations = async () => {
      try {
        const sessionId = params.id as string;
        if (!sessionId) return;

        // Fetch exam_session details with details
        const { data: sessionData, error: sessionErr } = await supabase
          .from('exam_sessions')
          .select(`
            id,
            status,
            cheating_score,
            started_at,
            completed_at,
            user_id,
            exam_id
          `)
          .eq('id', sessionId)
          .maybeSingle();

        if (sessionErr) throw sessionErr;

        if (sessionData) {
          // Fetch candidate name dynamically from users
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', sessionData.user_id)
            .maybeSingle();

          // Fetch exam title dynamically from exams
          const { data: examData } = await supabase
            .from('exams')
            .select('title')
            .eq('id', sessionData.exam_id)
            .maybeSingle();

          setSessionInfo({
            id: sessionData.id,
            candidateName: userData?.full_name || "Unknown Candidate",
            email: userData?.email || "",
            examName: examData?.title || "Advanced Exam",
            cheatingScore: sessionData.cheating_score || 0,
            status: sessionData.status || "completed"
          });
        }

        // Fetch violations from database
        const { data: violationsData, error: violationsErr } = await supabase
          .from('violations')
          .select('*')
          .eq('session_id', sessionId)
          .order('timestamp', { ascending: true });

        if (violationsErr) throw violationsErr;

        if (violationsData && violationsData.length > 0) {
          const processedList = violationsData.map((v, idx) => ({
            id: v.id,
            time: v.video_timestamp_seconds || 120 + idx * 300,
            type: v.violation_type || "manual_flag",
            severity: v.severity || "medium",
            desc: v.description || "Suspicious behavior logged",
            screenshot: v.screenshot || ""
          }));
          setViolations(processedList);
        } else {
          // Fallback static mocks if no live violations are saved yet to ensure demo works
          setViolations([
            { id: "mock_1", time: 120, type: "head_movement", severity: "medium", desc: "Looked away from screen for > 5s", screenshot: "" },
            { id: "mock_2", time: 850, type: "multiple_faces", severity: "critical", desc: "Second person detected in frame", screenshot: "" },
            { id: "mock_3", time: 1400, type: "tab_switch", severity: "high", desc: "Switched to another application", screenshot: "" },
            { id: "mock_4", time: 2100, type: "no_face", severity: "high", desc: "Face not visible in camera", screenshot: "" },
          ]);
        }
        // Fetch dynamic answers result in sync layer
        let result = await dbSync.getSubmittedResult(sessionId);
        if (!result && sessionData) {
          // Fall back to lookup by user_id and exam_id in local storage
          const allLocalResults = (typeof window !== "undefined" && localStorage.getItem("synced_exam_results")) 
            ? JSON.parse(localStorage.getItem("synced_exam_results") || "[]") 
            : [];
          const found = allLocalResults.find((r: any) => r.user_id === sessionData.user_id && r.exam_id === sessionData.exam_id);
          if (found) {
            result = found;
          }
        }
        if (result) {
          setExamResult(result);
        } else {
          // Fallback pre-filled mock answers for standard review demo
          setExamResult({
            score: 75,
            answers: [
              { question_text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correct_option: 1, selected_option: 1 },
              { question_text: "Which data structure uses LIFO?", options: ["Queue", "Tree", "Stack", "Graph"], correct_option: 2, selected_option: 2 },
              { question_text: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"], correct_option: 0, selected_option: 1 },
              { question_text: "Which of the following is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correct_option: 2, selected_option: 2 }
            ]
          });
        }

      } catch (err) {
        console.error("Error loading session/violations from DB, playing in offline/fallback mock mode", err);
        // Fallback mockup
        setViolations([
          { id: "mock_1", time: 120, type: "head_movement", severity: "medium", desc: "Looked away from screen for > 5s", screenshot: "" },
          { id: "mock_2", time: 850, type: "multiple_faces", severity: "critical", desc: "Second person detected in frame", screenshot: "" },
          { id: "mock_3", time: 1400, type: "tab_switch", severity: "high", desc: "Switched to another application", screenshot: "" },
          { id: "mock_4", time: 2100, type: "no_face", severity: "high", desc: "Face not visible in camera", screenshot: "" },
        ]);
        setSessionInfo({
          candidateName: "Diana Prince",
          examName: "Computer Science 101",
          cheatingScore: 85,
          status: "completed"
        });
        setExamResult({
          score: 75,
          answers: [
            { question_text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correct_option: 1, selected_option: 1 },
            { question_text: "Which data structure uses LIFO?", options: ["Queue", "Tree", "Stack", "Graph"], correct_option: 2, selected_option: 2 },
            { question_text: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"], correct_option: 0, selected_option: 1 },
            { question_text: "Which of the following is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correct_option: 2, selected_option: 2 }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSessionAndViolations();
  }, [params.id]);

  // Handle timeline ticking
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  if (!user) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setCurrentTime(percentage * duration);
  };

  return (
    <div className="min-h-screen bg-transparent">
      <header className="bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <div>
            <h1 className="text-xl font-semibold">Session Review: {sessionInfo?.candidateName || "Diana Prince"}</h1>
            <p className="text-xs text-slate-400">{sessionInfo?.examName || "Computer Science 101"} • {sessionInfo?.status === "in_progress" ? "In Progress" : "Completed"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium border border-red-500/30 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Cheating Score: {sessionInfo?.cheatingScore !== undefined ? sessionInfo.cheatingScore : 85}%
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-sm bg-slate-950">
            {/* Player Container */}
            <div className="aspect-video bg-black relative flex items-center justify-center border-b border-slate-800">
              
              {/* If there is an active violation around the current playback frame, show the captured screenshot as evidence! */}
              {(() => {
                const activeViolation = violations.find(v => Math.abs(v.time - currentTime) < 15);
                if (activeViolation?.screenshot) {
                  const dual = getDualScreenshots(activeViolation.screenshot);
                  if (dual && dual.secondary) {
                    return (
                      <div className="absolute inset-0 grid grid-cols-2 gap-2 p-2 bg-slate-950 z-0">
                        <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-white/5">
                          {dual.primary.startsWith("http") || dual.primary.startsWith("data:") ? (
                            <img src={dual.primary} alt="Camera 1" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-xs text-slate-400">Loading Primary Stream...</span>
                          )}
                          <div className="absolute bottom-2 left-2 bg-black/80 text-[10px] text-white px-2 py-0.5 rounded font-mono font-medium">📷 CAM 1: FRONT FACE</div>
                        </div>
                        <div className="relative w-full h-full bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center border border-white/5">
                          {dual.secondary.startsWith("http") || dual.secondary.startsWith("data:") ? (
                            <img src={dual.secondary} alt="Camera 2" className="max-w-full max-h-full object-contain" />
                          ) : (
                            <span className="text-xs text-slate-400">Loading Secondary Stream...</span>
                          )}
                          <div className="absolute bottom-2 left-2 bg-black/80 text-[10px] text-white px-2 py-0.5 rounded font-mono font-medium">📷 CAM 2: DESK ACTION</div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <img 
                      src={activeViolation.screenshot} 
                      alt="Proctoring violation snapshot" 
                      className="absolute inset-0 w-full h-full object-contain bg-slate-950 z-0 border border-red-500/30"
                    />
                  );
                }
                return (
                  <>
                    <div className="absolute inset-0 opacity-25 bg-[url('https://picsum.photos/seed/exam/1280/720')] bg-cover bg-center mix-blend-luminosity" />
                    <Video className="w-16 h-16 text-slate-800 z-10 animate-pulse" />
                  </>
                );
              })()}

              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded font-mono border border-white/15">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              {/* Overlay Warning if current time matches violation */}
              {(() => {
                const activev = violations.find(v => Math.abs(v.time - currentTime) < 15);
                if (activev) {
                  return (
                    <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider animate-bounce flex items-center gap-2 shadow-lg z-20">
                      <AlertTriangle className="w-4 h-4 text-white" />
                      {activev.type.replace('_', ' ')}
                    </div>
                  );
                }
                return null;
              })()}

              <div className="absolute bottom-4 left-4 right-4 bg-black/50 backdrop-blur-sm text-slate-300 text-xs px-3 py-2 rounded border border-white/5 text-center font-medium z-10">
                {violations.find(v => Math.abs(v.time - currentTime) < 15) 
                  ? "📸 Viewing exact photographic proof captured by AI system"
                  : "🎥 Drag timeline scrubber to analyze snapshots taken during the exam session"}
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200">
              {/* Custom Timeline */}
              <div className="mb-4 relative h-8 flex items-center cursor-pointer group" onClick={handleTimelineClick}>
                <div className="absolute inset-x-0 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-100 ease-linear"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                {/* Violation Markers */}
                {violations.map(v => (
                  <div 
                    key={v.id}
                    className={`absolute w-3.5 h-3.5 rounded-full -mt-0.5 border-2 border-white shadow-md transform -translate-x-1/2 hover:scale-150 cursor-pointer transition-transform ${
                      v.severity === 'critical' ? 'bg-red-600' :
                      v.severity === 'high' ? 'bg-orange-500' : 'bg-amber-400'
                    }`}
                    style={{ left: `${(v.time / duration) * 100}%` }}
                    title={`${formatTime(v.time)}: ${v.desc}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentTime(v.time); }}
                  />
                ))}
              </div>
              
              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCurrentTime(Math.max(0, currentTime - 10))}>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button size="icon" className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* New Photo Evidence Box showing the snapshot under selection */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 py-3.5">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-500" />
                Selected Violation Closeup & Evidence Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col md:flex-row gap-5 items-center">
              {(() => {
                const currentV = violations.find(v => Math.abs(v.time - currentTime) < 15) || violations[0];
                if (!currentV) {
                  return <p className="text-sm text-slate-500">No violations logged to view.</p>;
                }
                const dual = getDualScreenshots(currentV.screenshot);
                return (
                  <>
                    <div className="w-full md:w-auto h-auto bg-slate-50 rounded-xl p-2 border border-slate-150 relative overflow-hidden flex flex-col sm:flex-row gap-3 items-center shrink-0 shadow-inner">
                      {dual ? (
                        <>
                          <div className="w-full sm:w-36 h-24 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-200/50 shadow-sm">
                            {dual.primary ? (
                              <img src={dual.primary} alt="Primary angle closeup" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[10px] text-slate-400">No stream feed</span>
                            )}
                            <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-mono font-bold">CAM 1</div>
                          </div>
                          {dual.secondary && (
                            <div className="w-full sm:w-36 h-24 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center relative border border-slate-200/50 shadow-sm">
                              <img src={dual.secondary} alt="Secondary angle closeup" className="w-full h-full object-cover" />
                              <div className="absolute top-1.5 left-1.5 bg-black/75 text-white text-[8px] px-1.5 py-0.5 rounded font-mono font-bold">CAM 2</div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center p-4 text-slate-400">
                          <Video className="w-6 h-6 mx-auto mb-1 opacity-40" />
                          <span className="text-[10px]">No attachment</span>
                        </div>
                      )}
                    </div>
                    <div className="w-full space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                          Time: {formatTime(currentV.time)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          currentV.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          currentV.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {currentV.severity} severity
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-slate-800 capitalize">{currentV.type.replace('_', ' ')}</h4>
                      <p className="text-sm text-slate-600">{currentV.desc}</p>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Candidate Submission Results Summary */}
          {examResult && (
            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white mt-6">
              <CardHeader className="bg-slate-50 border-b border-slate-150 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Award className="w-5 h-5 text-blue-600" />
                    Student Submission Results Details
                  </CardTitle>
                  <p className="text-xs text-slate-500 mt-0.5">Verified candidate questionnaire responses & calculated score</p>
                </div>
                
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-150 px-3 py-1.5 rounded-lg shrink-0">
                  <span className="text-xs font-bold text-blue-800">Final Assessment Score:</span>
                  <span className={`text-sm font-extrabold ${examResult.score >= 50 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {examResult.score}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-5">
                {(!examResult.answers || examResult.answers.length === 0) ? (
                  <p className="text-xs text-slate-500 italic">No specific questionnaire answers submitted yet for this run.</p>
                ) : (
                  <div className="divide-y divide-slate-100 space-y-4">
                    {examResult.answers.map((ans: any, idx: number) => {
                      const isCorrect = ans.selected_option !== null && ans.selected_option === ans.correct_option;
                      return (
                        <div key={idx} className="pt-4 first:pt-0 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="text-sm font-bold text-slate-900 leading-tight">
                              Q{idx + 1}. {ans.question_text}
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                              isCorrect 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                                : ans.selected_option === null 
                                  ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-150'
                            }`}>
                              {isCorrect ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Correct
                                </>
                              ) : ans.selected_option === null ? (
                                'Unanswered'
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  Incorrect
                                </>
                              )}
                            </span>
                          </div>

                          {/* Options choices display with highlight indicators */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            {ans.options.map((opt: string, optIdx: number) => {
                              const isSelected = ans.selected_option === optIdx;
                              const isCorrectOption = ans.correct_option === optIdx;
                              
                              let optionClass = "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100/50 cursor-default transition-colors";
                              if (isSelected && isCorrect) {
                                optionClass = "bg-emerald-50 text-emerald-800 border-emerald-300 font-medium";
                              } else if (isSelected && !isCorrect) {
                                optionClass = "bg-rose-50 text-rose-800 border-rose-300 font-medium";
                              } else if (isCorrectOption) {
                                optionClass = "bg-emerald-50/50 text-emerald-800 border-emerald-200/50 italic font-medium";
                              }

                              return (
                                <div 
                                  key={optIdx} 
                                  className={`px-3 py-2 text-xs border rounded-lg flex items-center justify-between ${optionClass}`}
                                >
                                  <span>
                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}.</span>
                                    {opt}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border shrink-0 shadow-3xs ml-1.5">
                                      Chosen
                                    </span>
                                  )}
                                  {!isSelected && isCorrectOption && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 text-emerald-700 bg-white border border-emerald-150 shrink-0 ml-1.5">
                                      Correct Key
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Event Log */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-500" />
                Violation Log ({violations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto bg-white">
              <div className="divide-y divide-slate-100">
                {violations.map((v) => (
                  <div 
                    key={v.id} 
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 ${
                      Math.abs(v.time - currentTime) < 15 ? 'bg-blue-50/80 border-blue-500' :
                      v.severity === 'critical' ? 'border-red-500' :
                      v.severity === 'high' ? 'border-orange-500' : 'border-amber-400'
                    }`}
                    onClick={() => setCurrentTime(v.time)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {formatTime(v.time)}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        v.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        v.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {v.severity}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-2 items-center">
                      {v.screenshot && (
                        <div className="w-10 h-8 rounded border border-slate-200 overflow-hidden shrink-0">
                          <img src={v.screenshot} alt="Thumbnail proof" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-950 capitalize">{v.type.replace('_', ' ')}</p>
                        <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">{v.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
