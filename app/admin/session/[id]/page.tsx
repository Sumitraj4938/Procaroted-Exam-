"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, AlertTriangle, Clock, ShieldAlert, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function SessionReviewPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = 3600; // 1 hour in seconds

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  const violations = [
    { id: 1, time: 120, type: "head_movement", severity: "medium", desc: "Looked away from screen for > 5s" },
    { id: 2, time: 850, type: "multiple_faces", severity: "critical", desc: "Second person detected in frame" },
    { id: 3, time: 1400, type: "tab_switch", severity: "high", desc: "Switched to another application" },
    { id: 4, time: 2100, type: "no_face", severity: "high", desc: "Face not visible in camera" },
  ];

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Session Review: Bob Smith</h1>
            <p className="text-xs text-slate-400">Computer Science 101 • Completed</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm font-medium border border-red-500/30 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Cheating Score: 85%
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="aspect-video bg-black relative flex items-center justify-center">
              {/* Mock Video Feed */}
              <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/exam/1280/720')] bg-cover bg-center mix-blend-luminosity" />
              <Video className="w-16 h-16 text-slate-700 z-10" />
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              {/* Overlay Warning if current time matches violation */}
              {violations.find(v => Math.abs(v.time - currentTime) < 10) && (
                <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-3 py-1.5 rounded font-bold uppercase tracking-wider animate-pulse flex items-center gap-2 shadow-lg">
                  <AlertTriangle className="w-4 h-4" />
                  Violation Detected
                </div>
              )}
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
                    className={`absolute w-3 h-3 rounded-full -mt-0.5 border-2 border-white shadow-sm transform -translate-x-1/2 hover:scale-150 transition-transform ${
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
                <Button size="icon" className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700" onClick={() => setIsPlaying(!isPlaying)}>
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => setCurrentTime(Math.min(duration, currentTime + 10))}>
                  <SkipForward className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Event Log */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-slate-500" />
                Violation Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="divide-y divide-slate-100">
                {violations.map((v) => (
                  <div 
                    key={v.id} 
                    className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors border-l-4 ${
                      Math.abs(v.time - currentTime) < 10 ? 'bg-blue-50 border-blue-500' :
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
                    <p className="text-sm font-medium text-slate-900 mt-2">{v.type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-xs text-slate-600 mt-1">{v.desc}</p>
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
