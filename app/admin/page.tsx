"use client";

import Image from "next/image";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ShieldAlert, 
  Users, 
  Video, 
  Search, 
  Filter, 
  LogOut, 
  AlertTriangle, 
  Eye, 
  Loader2, 
  UserPlus, 
  Plus, 
  BookOpen, 
  CheckCircle2, 
  Trash2, 
  Sparkles, 
  Lock, 
  Mail, 
  UserCheck,
  Clock
} from "lucide-react";
import { supabase, toSafeUUID } from "@/lib/supabase";
import { dbSync, DBUser, DBCustomQuestion } from "@/lib/dbSync";

interface StudentSession {
  id: string;
  user_id: string;
  exam_id: string;
  status: string;
  cheating_score: number;
  score?: number;
  users: {
    full_name: string;
    email: string;
  };
  exams: {
    title: string;
  };
}

interface NewQuestionInput {
  question_text: string;
  options: string[];
  correct_option: number;
}

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"live" | "users" | "questions">("live");

  // Live session states
  const [filter, setFilter] = useState("all"); // all, high-risk
  const [sessions, setSessions] = useState<StudentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // User management states
  const [users, setUsers] = useState<DBUser[]>([]);
  const [userSearchText, setUserSearchText] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<"student" | "admin">("student");
  const [userSuccessMessage, setUserSuccessMessage] = useState("");
  const [userErrorMessage, setUserErrorMessage] = useState("");

  // Question assigner states
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignExamId, setAssignExamId] = useState("exam-1"); // defaulted to Math
  const [questionInputs, setQuestionInputs] = useState<NewQuestionInput[]>([
    { question_text: "", options: ["", "", "", ""], correct_option: 0 }
  ]);
  const [assignSuccess, setAssignSuccess] = useState("");
  const [assignError, setAssignError] = useState("");

  // Available Exams List (matched to student portal fallbacks)
  const defaultExams = [
    { id: "exam-1", title: "Advanced Mathematics" },
    { id: "exam-2", title: "Computer Science 101" },
    { id: "exam-3", title: "Physics Final" }
  ];

  // Load and refresh functions
  const fetchSessions = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }

      // 1. Fetch all student accounts (db + local cache)
      let allUsers: DBUser[] = [];
      try {
        allUsers = await dbSync.getUsers();
      } catch (uErr) {
        console.warn("Unification user fetch failed:", uErr);
        if (typeof window !== "undefined") {
          try {
            const syncedUsersRaw = localStorage.getItem("synced_users");
            allUsers = syncedUsersRaw ? JSON.parse(syncedUsersRaw) : [];
          } catch (e) {}
        }
      }

      // Ensure Sumit Raj profile exists
      const hasSumit = allUsers.some((u: any) => u.email.toLowerCase() === "sumitraj4938@gmail.com");
      if (!hasSumit) {
        allUsers.push({
          id: toSafeUUID("student-mock-id"),
          email: "sumitraj4938@gmail.com",
          role: "student",
          full_name: "Sumit Raj",
          created_at: new Date().toISOString()
        });
      }

      // 2. Fetch raw sessions from Supabase
      let sessionData: any[] = [];
      try {
        const { data, error } = await supabase
          .from('exam_sessions')
          .select('id, user_id, exam_id, status, cheating_score, score, answers_json, started_at, completed_at');
        
        if (!error && data) {
          sessionData = data;
        } else {
          console.warn("Resilient fetch sessionData select was flagged, retrying simpler select", error);
          const { data: fallbackData } = await supabase.from('exam_sessions').select('*');
          if (fallbackData) {
            sessionData = fallbackData;
          }
        }
      } catch (sErr) {
        console.warn("Caught exception reading exam_sessions remotely:", sErr);
      }

      // 3. Fetch exams list remotely
      let examData: any[] = [];
      try {
        const { data, error } = await supabase
          .from('exams')
          .select('id, title');
        if (!error && data) {
          examData = data;
        }
      } catch (eErr) {
        console.warn("Resilient exam cache fetch aborted:", eErr);
      }

      // 4. Perform high-performance client-side JOIN representing the relation
      const mergedSessions: any[] = [];

      sessionData.forEach((s: any) => {
        const matchedUser = allUsers.find((u: any) => toSafeUUID(u.id) === toSafeUUID(s.user_id));
        const matchedExam = examData.find((e: any) => toSafeUUID(e.id) === toSafeUUID(s.exam_id)) || 
                             defaultExams.find((e: any) => toSafeUUID(e.id) === toSafeUUID(s.exam_id));

        mergedSessions.push({
          id: s.id,
          user_id: toSafeUUID(s.user_id),
          exam_id: toSafeUUID(s.exam_id),
          status: s.status || "completed",
          cheating_score: s.cheating_score ?? 0,
          score: s.score ?? 0,
          answers_json: s.answers_json || [],
          users: {
            full_name: matchedUser?.full_name || "Student Candidate",
            email: matchedUser?.email || "student@example.com"
          },
          exams: {
            title: matchedExam?.title || "Advanced Mathematics"
          }
        });
      });

      // 5. Merge offline results from localStorage if present
      if (typeof window !== "undefined") {
        try {
          const localResultsRaw = localStorage.getItem("synced_exam_results");
          const localResults = localResultsRaw ? JSON.parse(localResultsRaw) : [];

          localResults.forEach((lr: any) => {
            const existingIdx = mergedSessions.findIndex(
              (s: any) => toSafeUUID(s.user_id) === toSafeUUID(lr.user_id) && toSafeUUID(s.exam_id) === toSafeUUID(lr.exam_id)
            );

            const matchedUser = allUsers.find((u: any) => toSafeUUID(u.id) === toSafeUUID(lr.user_id));
            const matchedUserFullName = matchedUser?.full_name || "Student Candidate";
            const matchedUserEmail = matchedUser?.email || "student@example.com";
            const examTitle = defaultExams.find(e => toSafeUUID(e.id) === toSafeUUID(lr.exam_id))?.title || "Advanced Exam";

            const localSessionEntry = {
              id: lr.session_id || toSafeUUID(`${lr.user_id}_${lr.exam_id}`),
              user_id: toSafeUUID(lr.user_id),
              exam_id: toSafeUUID(lr.exam_id),
              status: "completed",
              cheating_score: lr.cheating_score ?? 0,
              score: lr.score ?? 0,
              answers_json: lr.answers || [],
              users: {
                full_name: matchedUserFullName,
                email: matchedUserEmail
              },
              exams: {
                title: examTitle
              }
            };

            if (existingIdx >= 0) {
              mergedSessions[existingIdx] = {
                ...mergedSessions[existingIdx],
                status: "completed",
                score: mergedSessions[existingIdx].score ?? lr.score ?? 0,
                cheating_score: Math.max(mergedSessions[existingIdx].cheating_score, lr.cheating_score ?? 0),
                answers_json: mergedSessions[existingIdx].answers_json?.length > 0 ? mergedSessions[existingIdx].answers_json : (lr.answers || []),
                users: mergedSessions[existingIdx].users || localSessionEntry.users,
                exams: mergedSessions[existingIdx].exams || localSessionEntry.exams
              };
            } else {
              mergedSessions.push(localSessionEntry);
            }
          });
        } catch (e) {
          console.warn("Could not merge local offline storage entry in admin dashboard:", e);
        }
      }

      // 6. Synthesize "not_started" state representations for remaining active student records
      const allStudents = allUsers.filter((u: any) => u.role === "student" || u.role !== "admin");
      allStudents.forEach((student: any) => {
        const hasSession = mergedSessions.some(
          (s: any) => toSafeUUID(s.user_id) === toSafeUUID(student.id)
        );

        if (!hasSession) {
          mergedSessions.push({
            id: toSafeUUID(`${student.id}_exam-1`),
            user_id: toSafeUUID(student.id),
            exam_id: "exam-1",
            status: "not_started",
            cheating_score: 0,
            score: 0,
            answers_json: [],
            users: {
              full_name: student.full_name || "Student Candidate",
              email: student.email || "student@example.com"
            },
            exams: {
              title: "Advanced Mathematics"
            }
          });
        }
      });

      // Diana Prince safety net fallback
      if (mergedSessions.length === 0) {
        mergedSessions.push({
          id: "s4",
          user_id: "u4",
          exam_id: "exam-1",
          status: "terminated",
          cheating_score: 95,
          users: { full_name: "Diana Prince", email: "diana@example.com" },
          exams: { title: "Advanced Mathematics" }
        });
      }

      setSessions(mergedSessions);
    } catch (gErr) {
      console.error("Critical fallback triggered in unified fetchSessions:", gErr);
      setSessions([
        { id: "s4", user_id: "u4", exam_id: "exam-1", status: "terminated", cheating_score: 95, users: { full_name: "Diana Prince", email: "diana@example.com" }, exams: { title: "Advanced Mathematics" } },
      ] as any);
    } finally {
      setLoading(false);
    }
  };

  const loadUsersList = async () => {
    setUserLoading(true);
    try {
      const allUsers = await dbSync.getUsers();
      setUsers(allUsers);
    } catch (e) {
      console.warn("Error loading users", e);
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      router.push("/");
      return;
    }

    fetchSessions();
    loadUsersList();

    // Subscribe to realtime sessions changes
    const channel = supabase
      .channel('public:exam_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_sessions' }, payload => {
        fetchSessions(true); 
      })
      .subscribe();

    // Quick polling fallback for sandboxed environments where websockets are unstable
    const pollInterval = setInterval(() => {
      fetchSessions(true);
    }, 2500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  // Session simulator handler to allow quick creation of testing results
  const handleSimulateSession = async (studentId: string, examId: string = "exam-1") => {
    try {
      setLoading(true);
      const safeUserId = toSafeUUID(studentId);
      const safeExamId = toSafeUUID(examId);
      const sessionId = toSafeUUID(`${studentId}_${examId}`);

      // Choose a story archetype for simulated telemetry
      const randVal = Math.random();
      let cheatingScore = 15;
      let score = 85;
      let status = "completed";
      let violationsList: any[] = [];

      if (randVal < 0.35) {
        // High performing student with negligible warning
        cheatingScore = 5;
        score = 96;
        violationsList = [
          { type: "head_movement", desc: "Brief gaze deviation from screen monitor", severity: "low", time: 420 }
        ];
      } else if (randVal < 0.70) {
        // Some suspicious behavior (tab switches + look aways)
        cheatingScore = 45;
        score = 72;
        violationsList = [
          { type: "tab_switch", desc: "Forced system focus diversion (unauthorized tab switch)", severity: "medium", time: 720 },
          { type: "head_movement", desc: "Sustained ocular deviation (looking off-screen)", severity: "medium", time: 1300 },
          { type: "no_face", desc: "No face detected in active webcam frame", severity: "low", time: 1840 }
        ];
      } else {
        // Terminated cheating student
        cheatingScore = 95;
        score = 15;
        status = "terminated";
        violationsList = [
          { type: "tab_switch", desc: "Multiple window shifts / focus alterations logged", severity: "medium", time: 180 },
          { type: "multiple_faces", desc: "Secondary face detected within proctored zone", severity: "critical", time: 820 },
          { type: "no_face", desc: "Active candidate missing from video capture viewport", severity: "high", time: 1450 },
          { type: "identity_mismatch", desc: "Facial structural features recognition mismatch", severity: "critical", time: 2200 }
        ];
      }

      const mockAnswers = [
        { question_text: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"], correct_option: 1, selected_option: score > 60 ? 1 : 2 },
        { question_text: "Which data structure uses LIFO?", options: ["Queue", "Tree", "Stack", "Graph"], correct_option: 2, selected_option: 2 },
        { question_text: "What does HTTP stand for?", options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"], correct_option: 0, selected_option: score > 75 ? 0 : 3 },
        { question_text: "Which of the following is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correct_option: 2, selected_option: score > 30 ? 2 : 0 }
      ];

      // Remove existing records if conflict arises in remote DB
      try {
        await supabase.from("violations").delete().eq("session_id", sessionId);
        await supabase.from("exam_sessions").delete().eq("id", sessionId);
      } catch (err) {
        console.warn("Clean-up prior to simulation skipped", err);
      }

      // Insert mock session record
      const { error: sessionError } = await supabase
        .from('exam_sessions')
        .insert({
          id: sessionId,
          user_id: safeUserId,
          exam_id: safeExamId,
          status: status,
          cheating_score: cheatingScore,
          score: score,
          started_at: new Date(Date.now() - 3600000).toISOString(),
          completed_at: new Date().toISOString(),
          answers_json: mockAnswers
        });

      if (sessionError) {
        console.warn("Could not write remote mock session, syncing locally.", sessionError.message);
      }

      // Insert corresponding telemetry logs inside violations
      for (const v of violationsList) {
        try {
          await supabase
            .from("violations")
            .insert({
              session_id: sessionId,
              violation_type: v.type,
              description: v.desc,
              severity: v.severity,
              video_timestamp_seconds: v.time,
              screenshot: "https://picsum.photos/seed/" + v.type + "/640/480"
            });
        } catch (verr) {
          console.warn("Violation insert failed remotely:", verr);
        }
      }

      // Synchronize in browser client storage as reliable backup
      if (typeof window !== "undefined") {
        try {
          const resultsRaw = localStorage.getItem("synced_exam_results");
          const localResults = resultsRaw ? JSON.parse(resultsRaw) : [];
          const filtered = localResults.filter((r: any) => r.session_id !== sessionId);
          filtered.push({
            session_id: sessionId,
            user_id: safeUserId,
            exam_id: safeExamId,
            submitted_at: new Date().toISOString(),
            answers: mockAnswers,
            score: score,
            cheating_score: cheatingScore,
            total_questions: mockAnswers.length
          });
          localStorage.setItem("synced_exam_results", JSON.stringify(filtered));
        } catch (e) {
          console.warn("Failed to synchronize simulated session in local client storage", e);
        }
      }

      fetchSessions();
    } catch (e: any) {
      console.error("Simulation failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Delete/Reset specific exam session logs
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to completely clear and reset this student's exam session?")) return;
    try {
      setLoading(true);
      await supabase.from("violations").delete().eq("session_id", sessionId);
      await supabase.from("exam_sessions").delete().eq("id", sessionId);

      if (typeof window !== "undefined") {
        try {
          const resultsRaw = localStorage.getItem("synced_exam_results");
          if (resultsRaw) {
            const results = JSON.parse(resultsRaw);
            const filtered = results.filter((r: any) => r.session_id !== sessionId);
            localStorage.setItem("synced_exam_results", JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn("Failed to delete local state backups", e);
        }
      }

      fetchSessions();
    } catch (e: any) {
      console.error("Failed to delete user session", e);
    } finally {
      setLoading(false);
    }
  };

  // Delete registered student account
  const handleDeleteUser = async (userId: string, email: string) => {
    if (email === "sumitraj4938@gmail.com") {
      alert("System developer access administrator privileges cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently clear student registration "${email}"? This will delete all their saved assessments.`)) return;

    try {
      setLoading(true);
      
      // Select corresponding user sessions and purge
      const userSessions = sessions.filter(s => toSafeUUID(s.user_id) === toSafeUUID(userId));
      for (const s of userSessions) {
        await supabase.from("violations").delete().eq("session_id", s.id);
        await supabase.from("exam_sessions").delete().eq("id", s.id);
      }

      await supabase.from("users").delete().eq("id", userId);

      if (typeof window !== "undefined") {
        try {
          const syncedUsersRaw = localStorage.getItem("synced_users");
          if (syncedUsersRaw) {
            const localUsers = JSON.parse(syncedUsersRaw);
            const filtered = localUsers.filter((u: any) => toSafeUUID(u.id) !== toSafeUUID(userId));
            localStorage.setItem("synced_users", JSON.stringify(filtered));
          }
        } catch (e) {
          console.warn("Local storage clean error for user registration", e);
        }
      }

      loadUsersList();
      fetchSessions();
    } catch (e: any) {
      console.error("Failed to delete registered student", e);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  // Handles adding new user
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErrorMessage("");
    setUserSuccessMessage("");

    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim()) {
      setUserErrorMessage("Please fill out all fields.");
      return;
    }

    try {
      const added = await dbSync.addUser({
        full_name: registerName,
        email: registerEmail.trim(),
        password: registerPassword.trim(),
        role: registerRole,
      });

      setUserSuccessMessage(`Successfully registered ${added.full_name} (${added.role})!`);
      // Reset form
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterRole("student");
      
      // Refresh user selection pool and live monitor session list immediately
      loadUsersList();
      fetchSessions();
    } catch (err: any) {
      setUserErrorMessage(err?.message || "An error occurred during registration.");
    }
  };

  // Handles adding a new dynamic question slot to input form
  const addQuestionInputSlot = () => {
    setQuestionInputs([
      ...questionInputs,
      { question_text: "", options: ["", "", "", ""], correct_option: 0 }
    ]);
  };

  // Handles removing a question slot
  const removeQuestionInputSlot = (index: number) => {
    if (questionInputs.length <= 1) return;
    setQuestionInputs(questionInputs.filter((_, idx) => idx !== index));
  };

  // Updates single value inside dynamic question slot
  const updateQuestionField = (index: number, val: string) => {
    const updated = [...questionInputs];
    updated[index].question_text = val;
    setQuestionInputs(updated);
  };

  const updateQuestionOption = (qIdx: number, optIdx: number, val: string) => {
    const updated = [...questionInputs];
    updated[qIdx].options[optIdx] = val;
    setQuestionInputs(updated);
  };

  const updateQuestionCorrect = (qIdx: number, val: number) => {
    const updated = [...questionInputs];
    updated[qIdx].correct_option = val;
    setQuestionInputs(updated);
  };

  // Assigns questions list to selected student for selected exam
  const handleAssignQuestionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError("");
    setAssignSuccess("");

    if (!assignStudentId) {
      setAssignError("Please select a student to receive the questions.");
      return;
    }

    // Validation
    for (let i = 0; i < questionInputs.length; i++) {
      const qi = questionInputs[i];
      if (!qi.question_text.trim()) {
        setAssignError(`Question ${i + 1} has empty question text.`);
        return;
      }
      for (let o = 0; o < qi.options.length; o++) {
        if (!qi.options[o].trim()) {
          setAssignError(`Question ${i + 1} is missing Option ${String.fromCharCode(65 + o)}.`);
          return;
        }
      }
    }

    try {
      await dbSync.assignQuestions(assignStudentId, assignExamId, questionInputs);
      
      const recipient = users.find(u => u.id === assignStudentId);
      const targetExam = defaultExams.find(e => e.id === assignExamId);
      
      setAssignSuccess(`Custom questions specifically assigned to ${recipient?.full_name || "selected user"} for "${targetExam?.title}"!`);
      
      // Reset standard slot representation
      setQuestionInputs([
        { question_text: "", options: ["", "", "", ""], correct_option: 0 }
      ]);
    } catch (err: any) {
      setAssignError("Failed to assign questions database sync error.");
    }
  };

  // Live sessions queries
  const filteredSessions = sessions.filter(s => {
    const matchesFilter = filter === "high-risk" ? s.cheating_score > 50 : true;
    const matchesSearch = s.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.exams?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.users?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const activeSessionsCount = sessions.filter(s => s.status === 'in_progress').length;
  const highRiskCount = sessions.filter(s => s.cheating_score > 50).length;
  const terminatedCount = sessions.filter(s => s.status === 'terminated').length;

  return (
    <div className="min-h-screen bg-slate-50/55 text-slate-900 pb-12">
      {/* Universal Sticky Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row gap-4 items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-sm shrink-0" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Proctoring Control Center</h1>
            <p className="text-[10px] text-slate-400 font-mono">Control System • Real-Time Core</p>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 max-w-full overflow-x-auto text-xs font-medium">
          <button 
            onClick={() => setActiveTab("live")}
            className={`px-3 py-1.5 rounded transition-all shrink-0 ${activeTab === "live" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Live Monitor
          </button>
          <button 
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded transition-all shrink-0 ${activeTab === "users" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Add Student
          </button>
          <button 
            onClick={() => setActiveTab("questions")}
            className={`px-3 py-1.5 rounded transition-all shrink-0 ${activeTab === "questions" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"}`}
          >
            Assign Custom Questions
          </button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300 font-medium hidden md:inline">Admin: {user.fullName}</span>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => { logout(); router.push("/"); }}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 mt-4">
        
        {/* Statistics Widgets Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3.5 bg-blue-50 text-blue-600 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Sessions</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{loading ? "-" : activeSessionsCount}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">High Risk Candidates</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{loading ? "-" : highRiskCount}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white border-slate-200 shadow-sm hover:shadow transition-shadow">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Terminated Exams</p>
                <h3 className="text-3xl font-extrabold text-slate-900">{loading ? "-" : terminatedCount}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --------------------- TAB 1: LIVE MONITORING --------------------- */}
        {activeTab === "live" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-5/40">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-500" />
                  Live Exam Monitoring Dashboard
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Track real-time candidate verification, cheating metrics, and feeds</p>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate name, email, or exam..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
                <Button 
                  variant={filter === "high-risk" ? "default" : "outline"} 
                  className={`gap-2 text-xs font-semibold ${filter === "high-risk" ? "bg-slate-900 text-white" : ""}`}
                  onClick={() => setFilter(filter === "all" ? "high-risk" : "all")}
                >
                  <Filter className="w-4 h-4" />
                  {filter === "all" ? "Priority: High Risk" : "Display: All"}
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center items-center py-24">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-20 text-slate-500 bg-slate-50/20">
                  <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-base font-medium">No candidates currently recorded in testing runs</p>
                  <p className="text-xs text-slate-400 mt-1">Please start an exam flow inside a student window or add new student users</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold">Candidate</th>
                      <th className="px-6 py-4 font-bold">Assigned Assessment</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold">Cheating Score / AI Warning Log</th>
                      <th className="px-6 py-4 font-bold text-right">Review Session</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-inner">
                            {session.users?.full_name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <span className="block font-bold">{session.users?.full_name || 'Sumit Raj'}</span>
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5">{session.users?.email || 'sumitraj4938@gmail.com'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{session.exams?.title || 'Advanced Mathematics'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              session.status === 'not_started' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                              session.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse' :
                              session.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              'bg-red-50 text-red-700 border-red-100'
                            }`}>
                              {session.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {session.status === 'completed' && (
                              <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-xs">
                                Score: <b className="text-blue-600 font-extrabold">{(session as any).score ?? 0}%</b>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-28 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  session.cheating_score < 30 ? 'bg-emerald-500' :
                                  session.cheating_score < 70 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${session.cheating_score}%` }}
                              />
                            </div>
                            <span className={`font-mono text-xs font-bold ${
                              session.cheating_score >= 70 ? 'text-red-600 font-extrabold animate-pulse' : 'text-slate-600'
                            }`}>
                              {session.cheating_score}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            {session.status === 'not_started' ? (
                              <>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleSimulateSession(session.user_id, session.exam_id)}
                                  className="border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white hover:border-amber-600 text-[11px] font-black px-2.5 py-1 h-8 rounded-lg shadow-3xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500 hover:text-white group-hover:text-white" />
                                  Simulate Exam
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  disabled
                                  className="bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed shadow-none text-[11px] font-bold px-2.5 py-1 h-8 rounded-lg flex items-center gap-1"
                                >
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  Awaiting Start
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 h-8 w-8 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                  title="Delete & Reset Session"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="bg-white border-slate-200 text-blue-600 hover:text-white hover:bg-blue-600 shadow-3xs text-[11px] font-black px-2.5 py-1 h-8 rounded-lg flex items-center gap-1 cursor-pointer"
                                  onClick={() => router.push(`/admin/session/${session.id}`)}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Analyze Feeds
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* --------------------- TAB 2: USER MANAGEMENT --------------------- */}
        {activeTab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Addition Box */}
            <Card className="bg-white border-slate-200 shadow-sm h-fit">
              <CardHeader className="bg-slate-50/50 border-b border-slate-150">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                  Add New Assessment User
                </CardTitle>
                <CardDescription>Setup emails, passwords, and student credentials.</CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleAddUserSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Full Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="Shivam Raj"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      className="w-full text-sm border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email Address (Login ID)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="email"
                        required
                        placeholder="shivam@school.edu"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        className="w-full pl-9 text-sm border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Access Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input 
                        type="password"
                        required
                        placeholder="••••••••"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        className="w-full pl-9 text-sm border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Role Privileges</label>
                    <select 
                      value={registerRole}
                      onChange={(e) => setRegisterRole(e.target.value as any)}
                      className="w-full text-sm border border-slate-200 px-2 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="student">Student Account (Takes Exams)</option>
                      <option value="admin">Admin Operator (Analyzes Feeds)</option>
                    </select>
                  </div>

                  {userSuccessMessage && (
                    <div className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-150 p-3 rounded-lg flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 font-bold shrink-0" />
                      <span>{userSuccessMessage}</span>
                    </div>
                  )}

                  {userErrorMessage && (
                    <div className="text-xs font-medium text-rose-800 bg-rose-50 border border-rose-150 p-3 rounded-lg flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 font-bold shrink-0" />
                      <span>{userErrorMessage}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 rounded-lg flex items-center justify-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Register Credentials
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Users Pool List Display */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-150 flex flex-col sm:flex-row justify-between items-center bg-slate-50/40 gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4.5 h-4.5 text-slate-600" />
                    System Registration Pools
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">Total Synced: {users.length} accounts</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search accounts pool..."
                    value={userSearchText}
                    onChange={(e) => setUserSearchText(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[460px]">
                {userLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">No registered accounts pool found.</div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3">Account Name</th>
                        <th className="px-5 py-3">E-Mail Address</th>
                        <th className="px-5 py-3">Authorization Role</th>
                        <th className="px-5 py-3 text-right">Session Logs & Administrative Controls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users
                        .filter(u => 
                          u.full_name?.toLowerCase().includes(userSearchText.toLowerCase()) || 
                          u.email?.toLowerCase().includes(userSearchText.toLowerCase())
                        )
                        .map((u, i) => {
                          const userSession = sessions.find(s => toSafeUUID(s.user_id) === toSafeUUID(u.id));
                          return (
                            <tr key={u.id || i} className="hover:bg-slate-50/40 transition-colors">
                              <td className="px-5 py-3 font-bold text-slate-900 flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-slate-100 border text-[10px] font-bold text-slate-700 flex items-center justify-center">
                                  {u.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <span className="truncate max-w-[150px]">{u.full_name}</span>
                              </td>
                              <td className="px-5 py-3 font-mono text-slate-500">{u.email}</td>
                              <td className="px-5 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  u.role === "admin" ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-blue-100 text-blue-800 border-blue-200"
                                } border`}>
                                  {u.role.toUpperCase()}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-2 text-right">
                                  {u.role === "student" && (
                                    <>
                                      {userSession && userSession.status !== "not_started" ? (
                                        <div className="flex items-center gap-1.5">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold leading-none ${
                                            userSession.status === "in_progress" ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse" :
                                            userSession.status === "completed" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                            "bg-rose-50 text-rose-700 border-rose-100"
                                          } border`}>
                                            {userSession.status.toUpperCase()} ({userSession.cheating_score}% Risk)
                                          </span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="px-2 h-7 text-[10px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 border-slate-200 rounded-md cursor-pointer"
                                            onClick={() => router.push(`/admin/session/${userSession.id}`)}
                                          >
                                            View Report
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] text-slate-400 font-medium">Awaiting Test</span>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSimulateSession(u.id)}
                                            className="px-2 h-7 text-[10px] font-black border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-600 hover:text-white rounded-md flex items-center gap-0.5 cursor-pointer"
                                          >
                                            <Sparkles className="w-2.5 h-2.5 text-amber-500 fill-amber-500 hover:text-white" />
                                            Simulate Exam
                                          </Button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                  
                                  {u.email !== "sumitraj4938@gmail.com" && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteUser(u.id, u.email)}
                                      className="text-slate-400 hover:text-red-650 hover:bg-red-50 p-1 h-7 w-7 rounded-md cursor-pointer"
                                      title="Purge Account registration"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --------------------- TAB 3: ASSIGN QUESTIONS --------------------- */}
        {activeTab === "questions" && (
          <form onSubmit={handleAssignQuestionsSubmit} className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-150 py-5">
                <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      Specific Question Customizer tool
                    </CardTitle>
                    <CardDescription>Assemble custom questions assigned exclusively to specific targeted students.</CardDescription>
                  </div>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    className="self-start gap-1 text-xs font-bold border-blue-500 text-blue-600 hover:bg-blue-50 bg-white"
                    onClick={addQuestionInputSlot}
                  >
                    <Plus className="w-4 h-4" />
                    Add Additional Question Slot
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Configuration Panel */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                      1. Select Targeted Recipient Student
                    </label>
                    <select
                      value={assignStudentId}
                      required
                      onChange={(e) => setAssignStudentId(e.target.value)}
                      className="w-full text-sm border border-slate-200 px-3 py-2.5 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Choose active student from registration pool --</option>
                      {users
                        .filter(u => u.role === "student")
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      2. Select Target Assessment Exam
                    </label>
                    <select
                      value={assignExamId}
                      required
                      onChange={(e) => setAssignExamId(e.target.value)}
                      className="w-full text-sm border border-slate-200 px-3 py-2.5 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {defaultExams.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sub-Title Header */}
                <div className="border-b pb-1.5 border-dashed border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                    Assemble Questions Bundle
                  </h3>
                </div>

                {/* Dynamic Questions Slots */}
                <div className="space-y-6">
                  {questionInputs.map((qi, qIdx) => (
                    <div 
                      key={qIdx} 
                      className="p-5 border border-slate-200 rounded-xl relative hover:border-blue-200 transition-colors bg-white shadow-xs"
                    >
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        <span className="text-[10px] font-black font-mono text-slate-500 bg-slate-100 border px-2 py-0.5 rounded">QUESTION #{qIdx + 1}</span>
                        {questionInputs.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeQuestionInputSlot(qIdx)}
                            className="bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 p-1.5 rounded-md transition-colors"
                            title="Remove Question"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-4 mt-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold uppercase text-slate-500">Question Formulation Text</label>
                          <textarea
                            rows={2}
                            required
                            placeholder="e.g., What is the primary advantage of indexing in a database system?"
                            value={qi.question_text}
                            onChange={(e) => updateQuestionField(qIdx, e.target.value)}
                            className="w-full text-sm border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Four Option Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {qi.options.map((opt, optIdx) => (
                            <div key={optIdx} className="space-y-1">
                              <label className="text-xs font-medium text-slate-500">
                                Option {String.fromCharCode(65 + optIdx)}
                              </label>
                              <input 
                                type="text"
                                required
                                placeholder={`Enter Option ${String.fromCharCode(65 + optIdx)} choice`}
                                value={opt}
                                onChange={(e) => updateQuestionOption(qIdx, optIdx, e.target.value)}
                                className="w-full text-xs border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Correct Answer Selector */}
                        <div className="space-y-1.5 max-w-sm mt-1">
                          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">Correct Options Index Answer</label>
                          <select
                            value={qi.correct_option}
                            onChange={(e) => updateQuestionCorrect(qIdx, parseInt(e.target.value))}
                            className="w-full text-xs bg-slate-100 border border-slate-200 p-2.5 rounded-lg focus:outline-none text-slate-800 font-bold"
                          >
                            <option value={0}>Option A is Correct</option>
                            <option value={1}>Option B is Correct</option>
                            <option value={2}>Option C is Correct</option>
                            <option value={3}>Option D is Correct</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {assignSuccess && (
                  <div className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-150 p-4 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 font-bold shrink-0" />
                    <span>{assignSuccess}</span>
                  </div>
                )}

                {assignError && (
                  <div className="text-xs font-medium text-rose-800 bg-rose-50 border border-rose-150 p-4 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 font-bold shrink-0" />
                    <span>{assignError}</span>
                  </div>
                )}
              </CardContent>

              {/* Sticky assignment control card at base */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3.5">
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 py-3 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Save & Assign Custom Questions List
                </Button>
              </div>
            </Card>
          </form>
        )}
      </main>
    </div>
  );
}
