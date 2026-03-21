"use client";

import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, PlayCircle, CheckCircle, Clock } from "lucide-react";

export default function StudentDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== "student") {
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  const exams = [
    { id: "exam-1", title: "Advanced Mathematics", status: "pending", duration: 60, date: "Today, 10:00 AM" },
    { id: "exam-2", title: "Computer Science 101", status: "completed", duration: 90, date: "Yesterday, 2:00 PM" },
    { id: "exam-3", title: "Physics Final", status: "pending", duration: 120, date: "Tomorrow, 9:00 AM" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 w-8 h-8 rounded-md flex items-center justify-center text-white font-bold">
            AI
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  {exam.status === "pending" ? (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  ) : (
                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Completed
                    </span>
                  )}
                </div>
                <CardTitle className="text-xl">{exam.title}</CardTitle>
                <CardDescription>{exam.date}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-sm text-slate-600 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Duration: {exam.duration} minutes
                </div>
              </CardContent>
              <CardFooter>
                {exam.status === "pending" ? (
                  <Button className="w-full" onClick={() => router.push(`/exam/${exam.id}`)}>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Start Exam
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
      </main>
    </div>
  );
}
