"use client";

import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Users, Video, Search, Filter, LogOut, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface StudentSession {
  id: string;
  user_id: string;
  exam_id: string;
  status: string;
  cheating_score: number;
  users: {
    full_name: string;
    email: string;
  };
  exams: {
    title: string;
  };
}

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState("all"); // all, high-risk
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }

    const fetchSessions = async () => {
      try {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select(`
            id,
            user_id,
            exam_id,
            status,
            cheating_score,
            users ( full_name, email ),
            exams ( title )
          `)
          .order('started_at', { ascending: false });

        if (error) throw error;
        setSessions(data as any);
      } catch (error) {
        console.error("Error fetching sessions:", error);
        setSessions([
          { id: "s1", user_id: "u1", exam_id: "e1", status: "in_progress", cheating_score: 15, users: { full_name: "Alice Johnson", email: "alice@example.com" }, exams: { title: "Advanced Mathematics" } },
          { id: "s2", user_id: "u2", exam_id: "e2", status: "completed", cheating_score: 85, users: { full_name: "Bob Smith", email: "bob@example.com" }, exams: { title: "Computer Science 101" } },
          { id: "s3", user_id: "u3", exam_id: "e3", status: "in_progress", cheating_score: 45, users: { full_name: "Charlie Brown", email: "charlie@example.com" }, exams: { title: "Physics Final" } },
          { id: "s4", user_id: "u4", exam_id: "e4", status: "terminated", cheating_score: 95, users: { full_name: "Diana Prince", email: "diana@example.com" }, exams: { title: "Advanced Mathematics" } },
        ] as any);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('public:exam_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions' }, payload => {
        fetchSessions(); // Re-fetch to get joined data (users/exams)
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, router]);

  if (!user) return null;

  const filteredSessions = sessions.filter(s => {
    const matchesFilter = filter === "high-risk" ? s.cheating_score > 50 : true;
    const matchesSearch = s.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.exams?.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeSessionsCount = sessions.filter(s => s.status === 'in_progress').length;
  const highRiskCount = sessions.filter(s => s.cheating_score > 50).length;
  const terminatedCount = sessions.filter(s => s.status === 'terminated').length;

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
                <h3 className="text-2xl font-bold text-slate-900">{loading ? "-" : activeSessionsCount}</h3>
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
                <h3 className="text-2xl font-bold text-slate-900">{loading ? "-" : highRiskCount}</h3>
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
                <h3 className="text-2xl font-bold text-slate-900">{loading ? "-" : terminatedCount}</h3>
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
                  placeholder="Search student or exam..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                No sessions found matching your criteria.
              </div>
            ) : (
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
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                          {session.users?.full_name?.charAt(0) || '?'}
                        </div>
                        {session.users?.full_name || 'Unknown Student'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{session.exams?.title || 'Unknown Exam'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          session.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          session.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {session.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                session.cheating_score < 30 ? 'bg-emerald-500' :
                                session.cheating_score < 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${session.cheating_score}%` }}
                            />
                          </div>
                          <span className={`font-medium ${
                            session.cheating_score >= 70 ? 'text-red-600' : 'text-slate-600'
                          }`}>
                            {session.cheating_score}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => router.push(`/admin/session/${session.id}`)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
