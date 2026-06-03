-- Supabase Schema for AI Proctored Exam System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to ensure a clean slate (WARNING: This deletes existing data in these tables)
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
    options JSONB NOT NULL, -- e.g., ["A", "B", "C", "D"]
    correct_option INTEGER NOT NULL, -- index of the correct option
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
    violation_type TEXT NOT NULL, -- e.g., 'no_face', 'multiple_faces', 'tab_switch', 'head_movement'
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    video_timestamp_seconds INTEGER, -- For video playback sync
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    screenshot TEXT -- base64 data-url or attachment url of the exact violation frame
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Simplified for demonstration)
CREATE POLICY "Users can view their own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all users" ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Students can view exams" ON exams FOR SELECT USING (true);
CREATE POLICY "Students can view questions for active exams" ON questions FOR SELECT USING (true);

CREATE POLICY "Students can view their own sessions" ON exam_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can insert their own sessions" ON exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students can update their own sessions" ON exam_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Students can insert answers for their sessions" ON answers FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM exam_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY "Students can view their own answers" ON answers FOR SELECT USING (EXISTS (SELECT 1 FROM exam_sessions WHERE id = session_id AND user_id = auth.uid()));

CREATE POLICY "Students can insert violations for their sessions" ON violations FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM exam_sessions WHERE id = session_id AND user_id = auth.uid()));
CREATE POLICY "Admins can view all violations" ON violations FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Realtime Subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE exam_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;
