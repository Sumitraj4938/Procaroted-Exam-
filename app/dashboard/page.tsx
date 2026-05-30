"use client";

import Image from "next/image";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, PlayCircle, CheckCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  start_time: string;
  status: 'pending' | 'in_progress' | 'completed' | 'terminated';
}

export default function StudentDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "student") {
      router.push("/");
      return;
    }

    const fetchExams = async () => {
      try {
        // Fetch all exams
        const { data: allExams, error: examsError } = await supabase
          .from('exams')
          .select('*')
          .order('start_time', { ascending: false });

        if (examsError) throw examsError;

        // Fetch user's sessions to determine status
        const { data: sessions, error: sessionsError } = await supabase
          .from('exam_sessions')
          .select('exam_id, status')
          .eq('user_id', user.id);

        if (sessionsError) throw sessionsError;

        // Map exams with their session status
        const examsWithStatus = allExams.map(exam => {
          const session = sessions?.find(s => s.exam_id === exam.id);
          return {
            ...exam,
            status: session?.status || 'pending'
          };
        });

        setExams(examsWithStatus);
      } catch (error) {
        console.error("Error fetching exams, falling back to mock data:", error);
        // Fallback data so the app always works even if DB is unconfigured
        setExams([
          { id: "exam-1", title: "Advanced Mathematics", description: "Final semester examination covering calculus and linear algebra.", duration_minutes: 60, start_time: new Date().toISOString(), status: "pending" },
          { id: "exam-2", title: "Computer Science 101", description: "Introduction to programming and data structures.", duration_minutes: 90, start_time: new Date(Date.now() - 86400000).toISOString(), status: "completed" },
          { id: "exam-3", title: "Physics Final", description: "Comprehensive physics assessment.", duration_minutes: 120, start_time: new Date(Date.now() + 86400000).toISOString(), status: "pending" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-transparent">
      <header className="bg-white/95 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <h1 className="text-xl font-semibold text-slate-800">Student Portal</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 font-medium">Welcome, {user.fullName}</span>
          <Button variant="ghost" size="sm" onClick={() => { logout(); router.push("/"); }}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 mt-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">Your Exams</h2>
          <p className="text-slate-500 mt-2">Manage your upcoming and completed assessments.</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
            <p className="text-slate-500">No exams available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <Card key={exam.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    {exam.status === "pending" ? (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending
                      </span>
                    ) : exam.status === "in_progress" ? (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" /> In Progress
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-xl">{exam.title}</CardTitle>
                  <CardDescription>
                    {new Date(exam.start_time).toLocaleDateString(undefined, { 
                      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="text-sm text-slate-600 flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" />
                    Duration: {exam.duration_minutes} minutes
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2">{exam.description}</p>
                </CardContent>
                <CardFooter>
                  {exam.status === "pending" || exam.status === "in_progress" ? (
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => router.push(`/exam/${exam.id}`)}>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      {exam.status === "in_progress" ? "Resume Exam" : "Start Exam"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      View Results
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
