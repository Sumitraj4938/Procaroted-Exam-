"use client";

import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Users, Video, Search, Filter, LogOut, AlertTriangle, Eye } from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState("all"); // all, high-risk

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  const students = [
    { id: "s1", name: "Alice Johnson", exam: "Advanced Mathematics", status: "in_progress", score: 10, risk: "low" },
    { id: "s2", name: "Bob Smith", exam: "Computer Science 101", status: "completed", score: 85, risk: "high" },
    { id: "s3", name: "Charlie Brown", exam: "Physics Final", status: "in_progress", score: 45, risk: "medium" },
    { id: "s4", name: "Diana Prince", exam: "Advanced Mathematics", status: "terminated", score: 100, risk: "critical" },
  ];

  const filteredStudents = filter === "high-risk" 
    ? students.filter(s => s.score > 50) 
    : students;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 w-8 h-8 rounded-md flex items-center justify-center font-bold">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold">Proctoring Control Center</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300 font-medium">Admin: {user.fullName}</span>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => { logout(); router.push("/"); }}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Active Sessions</p>
                <h3 className="text-2xl font-bold text-slate-900">24</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">High Risk Candidates</p>
                <h3 className="text-2xl font-bold text-slate-900">3</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Terminated Exams</p>
                <h3 className="text-2xl font-bold text-slate-900">1</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-800">Live Monitoring</h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search student..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button 
                variant={filter === "high-risk" ? "default" : "outline"} 
                className="gap-2"
                onClick={() => setFilter(filter === "all" ? "high-risk" : "all")}
              >
                <Filter className="w-4 h-4" />
                {filter === "all" ? "Show High Risk" : "Show All"}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Exam</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Cheating Score</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                        {student.name.charAt(0)}
                      </div>
                      {student.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">{student.exam}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        student.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        student.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {student.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              student.score < 30 ? 'bg-emerald-500' :
                              student.score < 70 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${student.score}%` }}
                          />
                        </div>
                        <span className={`font-medium ${
                          student.score >= 70 ? 'text-red-600' : 'text-slate-600'
                        }`}>
                          {student.score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => router.push(`/admin/session/${student.id}`)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
