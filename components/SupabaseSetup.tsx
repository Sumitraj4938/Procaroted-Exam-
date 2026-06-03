"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Database, Copy, Check, Sparkles, RefreshCw, AlertTriangle, HelpCircle, HardDrive } from "lucide-react";

export default function SupabaseSetup() {
  const [copied, setCopied] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [isOpen, setIsOpen] = useState(false);
  const [dbState, setDbState] = useState<{ checked: boolean; hasTables: boolean; isEmpty: boolean }>({
    checked: false,
    hasTables: true,
    isEmpty: false,
  });

  const sqlSchema = `-- Copy this SQL Script to Supabase SQL Editor to initialize all tables
-- Go to your Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS exam_sessions CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS exams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'password',
    role TEXT CHECK (role IN ('student', 'admin')) DEFAULT 'student',
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exams Table
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions Table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option INTEGER NOT NULL,
    points INTEGER DEFAULT 1
);

-- Exam Sessions (Student taking an exam)
CREATE TABLE exam_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'terminated')) DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cheating_score INTEGER DEFAULT 0,
    UNIQUE(user_id, exam_id)
);

-- Answers Table
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    selected_option INTEGER,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, question_id)
);

-- Violations (Cheating Logs)
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES exam_sessions(id) ON DELETE CASCADE,
    violation_type TEXT NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    video_timestamp_seconds INTEGER,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    screenshot TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Disable strict policies for effortless demo & client sync setup
CREATE POLICY "Allow public select users" ON users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON users FOR UPDATE USING (true);
CREATE POLICY "Allow public upsert users" ON users FOR ALL USING (true);

CREATE POLICY "Allow public select exams" ON exams FOR SELECT USING (true);
CREATE POLICY "Allow public select questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Allow public select sessions" ON exam_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert sessions" ON exam_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sessions" ON exam_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public insert answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Allow public insert violations" ON violations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select violations" ON violations FOR SELECT USING (true);

-- Enable Realtime
alter publication supabase_realtime add table exam_sessions;
alter publication supabase_realtime add table violations;
`;

  const checkDbStatus = async () => {
    try {
      const { data, error } = await supabase.from("exams").select("id").limit(1);
      if (error) {
        if (error.code === "42P01") {
          // Relation/table does not exist
          setDbState({ checked: true, hasTables: false, isEmpty: true });
        } else {
          setDbState({ checked: true, hasTables: true, isEmpty: true });
        }
      } else {
        const isEmpty = !data || data.length === 0;
        setDbState({ checked: true, hasTables: true, isEmpty });
      }
    } catch (e) {
      setDbState({ checked: true, hasTables: false, isEmpty: true });
    }
  };

  useEffect(() => {
    checkDbStatus();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seedDefaultData = async () => {
    setSeeding(true);
    setSeedStatus({ type: null, message: "" });
    try {
      // 1. Insert exams
      const defaultExams = [
        {
          id: "3491ebca-82ca-49a6-be5e-6fa2377fd001",
          title: "Advanced Mathematics",
          description: "Final semester examination covering calculus, linear algebra, and complex variables.",
          duration_minutes: 60,
          start_time: new Date().toISOString(),
        },
        {
          id: "3491ebca-82ca-49a6-be5e-6fa2377fd002",
          title: "Computer Science 101",
          description: "Core introduction of algorithms, complexity analyses, and object-oriented data structures.",
          duration_minutes: 90,
          start_time: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: "3491ebca-82ca-49a6-be5e-6fa2377fd003",
          title: "Physics Final",
          description: "Comprehensive assessment covering mechanics, quantum theory, and thermodynamics.",
          duration_minutes: 120,
          start_time: new Date(Date.now() + 86400000).toISOString(),
        },
      ];

      // Upsert exams 
      const { error: examErr } = await supabase.from("exams").upsert(defaultExams);
      if (examErr) {
        if (examErr.code === "42P01") {
          throw new Error("Tables are missing! Please paste and run the SQL schema in your Supabase SQL Editor first.");
        }
        throw examErr;
      }

      // 2. Insert questions for Advanced Mathematics (exam-1 UUID: 3491ebca-82ca-49a6-be5e-6fa2377fd001)
      const defaultQuestions = [
        {
          id: "5ff2fa10-82cb-46b7-be5e-7fa2500fa001",
          exam_id: "3491ebca-82ca-49a6-be5e-6fa2377fd001",
          question_text: "What is the time complexity of binary search?",
          options: ["O(n)", "O(log n)", "O(n^2)", "O(1)"],
          correct_option: 1,
          points: 1,
        },
        {
          id: "5ff2fa10-82cb-46b7-be5e-7fa2500fa002",
          exam_id: "3491ebca-82ca-49a6-be5e-6fa2377fd001",
          question_text: "Which data structure uses LIFO?",
          options: ["Queue", "Tree", "Stack", "Graph"],
          correct_option: 2,
          points: 1,
        },
        {
          id: "5ff2fa10-82cb-46b7-be5e-7fa2500fa003",
          exam_id: "3491ebca-82ca-49a6-be5e-6fa2377fd001",
          question_text: "What does HTTP stand for?",
          options: ["HyperText Transfer Protocol", "HyperText Transmission Protocol", "HyperText Transfer Package", "HyperText Transmission Package"],
          correct_option: 0,
          points: 1,
        },
        {
          id: "5ff2fa10-82cb-46b7-be5e-7fa2500fa004",
          exam_id: "3491ebca-82ca-49a6-be5e-6fa2377fd001",
          question_text: "Which of the following is a NoSQL database?",
          options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"],
          correct_option: 2,
          points: 1,
        },
      ];

      // Upsert questions
      const { error: questErr } = await supabase.from("questions").upsert(defaultQuestions);
      if (questErr) throw questErr;

      // 3. Setup standard users
      const defaultUsers = [
        {
          id: "1a92e100-3cb7-49ec-86eb-6be0b7f8c001",
          email: "sumitraj4938@gmail.com",
          password: "Sumit@4938",
          role: "student",
          full_name: "Sumit Raj"
        },
        {
          id: "2b92e100-3cb7-49ec-86eb-6be0b7f8c002",
          email: "sumitraj4939@gmail.com",
          password: "Sumit@4939",
          role: "admin",
          full_name: "Sumit Raj (Admin)"
        }
      ];

      const { error: userErr } = await supabase.from("users").upsert(defaultUsers);
      if (userErr) throw userErr;

      setSeedStatus({ type: "success", message: "Supabase seeded successfully! Standard exams, questions, and users are ready." });
      checkDbStatus();
    } catch (e: any) {
      console.error(e);
      setSeedStatus({ type: "error", message: e.message || "An error occurred during database seeding." });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6 mt-4">
      <div className="flex justify-between items-center bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg">
            <Database className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              Supabase Project Status Indicator
              {!dbState.hasTables && (
                <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Tables Missing
                </span>
              )}
              {dbState.hasTables && dbState.isEmpty && (
                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Database Empty
                </span>
              )}
              {dbState.hasTables && !dbState.isEmpty && (
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Synced & Connected
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {!dbState.hasTables 
                ? "Tables need to be created in your Supabase SQL Editor to support persistent cloud proctoring logs." 
                : dbState.isEmpty 
                  ? "Your Supabase project is empty. Click configure to populate default exams, questions, and users." 
                  : "All tables and sync structures are fully configured on your remote project."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsOpen(!isOpen)}
            className="bg-white hover:bg-slate-100 text-xs font-bold border-slate-200"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            {isOpen ? "Hide Helper" : "Setup Database"}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={checkDbStatus}
            className="text-slate-600 hover:bg-slate-100 h-8 w-8 p-0"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isOpen && (
        <Card className="mt-4 border-slate-200 bg-white/60 backdrop-blur shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-slate-50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
              <Sparkles className="w-5 h-5 text-blue-500" />
              1-Click Supabase DB Setup Helper
            </CardTitle>
            <CardDescription>
              Configure and seed your new remote Supabase project under 10 seconds.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Step 1: Execute SQL Schema */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black">1</span>
                  Create Tables using SQL Editor
                </h5>
                <Button 
                  onClick={handleCopy} 
                  size="sm" 
                  variant="outline" 
                  className="bg-white border-slate-200 h-8 text-xs font-bold"
                >
                  {copied ? <Check className="w-4 h-4 mr-1 text-emerald-600" /> : <Copy className="w-4 h-4 mr-1 text-slate-500" />}
                  {copied ? "Copied!" : "Copy SQL Script"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Go to your{" "}
                <a 
                  href="https://supabase.com/dashboard" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Supabase Dashboard
                </a>
                , click <b>SQL Editor</b> on the left rail, select <b>New Query</b>, paste this block, and click <b>Run</b>:
              </p>
              <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto max-h-48 border border-slate-800">
                <pre className="text-[10px] font-mono text-slate-300 leading-relaxed text-left">
                  {sqlSchema}
                </pre>
              </div>
            </div>

            {/* Step 2: Seed Data */}
            <div className="border-t border-slate-100 pt-6 space-y-3">
              <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-black">2</span>
                Seed Default Database Contents
              </h5>
              <p className="text-xs text-slate-500">
                Once tables are created, click below to populate standard exams, core questions/options, and pre-authorized user credentials instantly:
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
                <Button 
                  onClick={seedDefaultData} 
                  disabled={seeding}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-9 shadow-sm"
                >
                  {seeding ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Seeding Database...
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-4 h-4 mr-2" />
                      ⚡ Seed Default Exams & Questions
                    </>
                  )}
                </Button>
                
                {seedStatus.type && (
                  <div className={`text-xs px-3 py-2 rounded-lg border ${
                    seedStatus.type === "success" 
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                      : "bg-rose-50 text-rose-800 border-rose-200"
                  }`}>
                    {seedStatus.message}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-100 border-t border-slate-200/50 py-3 px-6 flex justify-between text-[11px] text-slate-500 font-medium">
            <span>Project Link: https://bdzcvjnmxqblprwksvbi.supabase.co</span>
            <span>Role: Anon Client Client-Side Sync</span>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
