import { supabase, generateUUID, toSafeUUID } from "@/lib/supabase";

export interface DBUser {
  id: string;
  email: string;
  password?: string;
  role: "student" | "admin";
  full_name: string;
  created_at?: string;
}

export interface DBCustomQuestion {
  id: string;
  exam_id: string;
  student_id: string; // The specific student assigned to this question
  question_text: string;
  options: string[];
  correct_option: number;
}

export interface DBAnswer {
  question_text: string;
  options: string[];
  correct_option: number;
  selected_option: number | null;
}

export interface DBResult {
  session_id: string;
  user_id: string;
  exam_id: string;
  submitted_at: string;
  answers: DBAnswer[];
  score: number;
  total_questions: number;
}

// Ensure window is defined for client-side storage
const isClient = typeof window !== "undefined";

const getLocalItem = (key: string): any[] => {
  if (!isClient) return [];
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return [];
  }
};

const setLocalItem = (key: string, data: any[]): void => {
  if (!isClient) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
};

export const dbSync = {
  // --- USERS MANAGEMENT ---
  async authenticate(email: string, password: string): Promise<DBUser | null> {
    // 1. First check remote Supabase
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .eq("password", password)
        .maybeSingle();
        
      if (data && !error) {
        return {
          id: data.id,
          email: data.email,
          role: data.role as "student" | "admin",
          full_name: data.full_name || data.email.split('@')[0],
        };
      }
    } catch (e) {
      console.warn("Supabase auth error, checking synced users", e);
    }

    // 2. Check local sync list
    const synced = getLocalItem("synced_users") as DBUser[];
    const match = synced.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    return match || null;
  },

  async getUsers(): Promise<DBUser[]> {
    const localUsers = getLocalItem("synced_users") as DBUser[];
    
    // Helper to ensure Sumit Raj is in a list
    const ensureSumit = (list: any[]) => {
      const hasSumit = list.some((u) => u.email.toLowerCase() === "sumitraj4938@gmail.com");
      if (!hasSumit) {
        list.push({
          id: "student-mock-id",
          email: "sumitraj4938@gmail.com",
          role: "student",
          full_name: "Sumit Raj",
          created_at: new Date().toISOString()
        });
      }
      return list;
    };

    try {
      // Query Supabase users
      const { data, error } = await supabase
        .from("users")
        .select("id, email, role, full_name, created_at");
        
      if (error) {
        console.warn("Could not load users from Supabase, relying on local sync", error);
        return ensureSumit([...localUsers]) as DBUser[];
      }

      // Merge Supabase users with local custom users (deduplicate by email)
      const merged: any[] = [...(data || [])];
      localUsers.forEach((lu) => {
        if (!merged.some((u) => u.email.toLowerCase() === lu.email.toLowerCase())) {
          merged.push(lu);
        }
      });
      return ensureSumit(merged) as DBUser[];
    } catch (err) {
      console.error("Failed to fetch users", err);
      return ensureSumit([...localUsers]) as DBUser[];
    }
  },

  async addUser(newUser: Omit<DBUser, "id">): Promise<DBUser> {
    const id = generateUUID();
    const userWithId: DBUser = {
      ...newUser,
      id,
      created_at: new Date().toISOString(),
    };

    // Save locally
    const localUsers = getLocalItem("synced_users");
    localUsers.push(userWithId);
    setLocalItem("synced_users", localUsers);

    // Try saving to Supabase
    try {
      const { data, error } = await supabase
        .from("users")
        .insert({
          id,
          email: newUser.email,
          password: newUser.password || "password",
          role: newUser.role,
          full_name: newUser.full_name,
        })
        .select()
        .single();

      if (error) {
        console.warn("Supabase user insert skipped (RLS/constraint). Local state remains active.", error.message);
      } else if (data) {
        console.log("Supabase user registration successful");
      }
    } catch (err) {
      console.warn("Supabase user insert error. Synced locally instead", err);
    }

    return userWithId;
  },

  // --- CUSTOM QUESTIONS ASSIGNMENTS ---
  async getAssignedQuestions(studentId: string, examId: string): Promise<DBCustomQuestion[]> {
    const localAssigned = getLocalItem("assigned_questions") as DBCustomQuestion[];
    
    // Filter questions assigned specifically to this student and this exam
    let studentQuestions = localAssigned.filter(
      (q) => q.student_id === studentId && q.exam_id === examId
    );

    try {
      // Try to fetch custom questions from Supabase questions table
      const { data, error } = await supabase
        .from("questions")
        .select("*")
        .eq("exam_id", examId);

      if (!error && data && data.length > 0) {
        // First look for student-specific questions from database
        let dbStudentQuestions = (data as any[]).filter(
          (q) => q.student_id === studentId || q.user_id === studentId
        );
        
        // If there are none assigned specifically to this student, use standard questions for this exam
        if (dbStudentQuestions.length === 0) {
          dbStudentQuestions = (data as any[]).filter((q) => !q.student_id && !q.user_id);
        }

        if (dbStudentQuestions.length > 0) {
          // Format as standard custom question format
          const formatted = dbStudentQuestions.map((q) => ({
            id: q.id,
            exam_id: q.exam_id,
            student_id: studentId,
            question_text: q.question_text || q.question,
            options: Array.isArray(q.options) ? q.options : JSON.parse(q.options || "[]"),
            correct_option: q.correct_option ?? 0,
          }));
          
          // Merge to avoid duplicates
          formatted.forEach((q) => {
            if (!studentQuestions.some((sq) => sq.question_text === q.question_text)) {
              studentQuestions.push(q);
            }
          });
        }
      }
    } catch (err) {
      console.warn("Supabase assigned questions load failed, showing locally assigned questions", err);
    }

    return studentQuestions;
  },

  async assignQuestions(
    studentId: string,
    examId: string,
    questions: Omit<DBCustomQuestion, "id" | "student_id" | "exam_id">[]
  ): Promise<void> {
    const localAssigned = getLocalItem("assigned_questions") as DBCustomQuestion[];

    // Remove old questions assigned to this student for this exam to overwrite
    const filteredLocal = localAssigned.filter(
      (q) => !(q.student_id === studentId && q.exam_id === examId)
    );

    const newQuestions = questions.map((q) => ({
      ...q,
      id: "q_" + Math.random().toString(36).substring(4),
      student_id: studentId,
      exam_id: examId,
    }));

    const updated = [...filteredLocal, ...newQuestions];
    setLocalItem("assigned_questions", updated);

    // Try to insert each question into Supabase in background
    for (const q of newQuestions) {
      try {
        await supabase
          .from("questions")
          .insert({
            exam_id: q.exam_id,
            question_text: q.question_text,
            options: q.options,
            correct_option: q.correct_option,
            points: 1,
            // Try to set student_id if schema has it (wrapped securely)
            student_id: q.student_id, 
          });
      } catch (e) {
        // Safe to swallow, RLS or schema column missing
      }
    }
  },

  // --- STUDENT RESULTS & SUBMISSIONS ---
  async saveAnswersAndResult(
    sessionId: string,
    userId: string,
    examId: string,
    answers: DBAnswer[],
    score: number
  ): Promise<void> {
    const result: DBResult = {
      session_id: sessionId,
      user_id: userId,
      exam_id: examId,
      submitted_at: new Date().toISOString(),
      answers,
      score,
      total_questions: answers.length,
    };

    const results = getLocalItem("synced_exam_results") as DBResult[];
    
    // Remove duplication
    const updated = results.filter((r) => r.session_id !== sessionId);
    updated.push(result);
    setLocalItem("synced_exam_results", updated);

    // Try to update session meta or answers table on Supabase in a backward-compatible format
    try {
      const updatePayload: any = {
        status: "completed",
        completed_at: new Date().toISOString(),
      };

      try {
        const { error } = await supabase
          .from("exam_sessions")
          .update({
            ...updatePayload,
            score: score,
            answers_json: answers,
          })
          .eq("id", sessionId);

        if (error) {
          console.warn("Could not insert score/answers_json directly to exam_sessions (old schema). Retrying with standard columns.", error);
          await supabase
            .from("exam_sessions")
            .update(updatePayload)
            .eq("id", sessionId);
        }
      } catch (innerErr) {
        await supabase
          .from("exam_sessions")
          .update(updatePayload)
          .eq("id", sessionId);
      }

      // Try inserting into answers table
      for (let i = 0; i < answers.length; i++) {
        try {
          await supabase
            .from("answers")
            .insert({
              session_id: sessionId,
              selected_option: answers[i].selected_option,
            });
        } catch (dbErr) {
          // Handle or ignore if schema constraints block it
        }
      }
    } catch (err) {
      console.warn("Could not write exam status to live Supabase, saved locally instead", err);
    }
  },

  async getSubmittedResult(sessionId: string): Promise<DBResult | null> {
    // 1. First, check if we have a local result
    const localResults = getLocalItem("synced_exam_results") as DBResult[];
    const localFound = localResults.find((r) => r.session_id === sessionId);
    if (localFound) return localFound;

    // 2. Try fetching from Supabase exam_sessions
    try {
      const { data: sessionData, error: sessionErr } = await supabase
        .from("exam_sessions")
        .select("id, user_id, exam_id, score, answers_json, completed_at")
        .eq("id", sessionId)
        .maybeSingle();

      if (!sessionErr && sessionData) {
        if (sessionData.score !== null && sessionData.score !== undefined && sessionData.answers_json) {
          const parsedAnswers = Array.isArray(sessionData.answers_json)
            ? sessionData.answers_json
            : typeof sessionData.answers_json === "string"
              ? JSON.parse(sessionData.answers_json)
              : sessionData.answers_json;

          return {
            session_id: sessionData.id,
            user_id: sessionData.user_id,
            exam_id: sessionData.exam_id,
            submitted_at: sessionData.completed_at || new Date().toISOString(),
            answers: parsedAnswers,
            score: sessionData.score ?? 0,
            total_questions: Array.isArray(parsedAnswers) ? parsedAnswers.length : 0,
          };
        }

        // 3. Fallback: query standard answers + questions from database
        const { data: userAnswers, error: answersError } = await supabase
          .from("answers")
          .select("question_id, selected_option")
          .eq("session_id", sessionId);

        const { data: examQuestions, error: questionsError } = await supabase
          .from("questions")
          .select("id, question_text, options, correct_option")
          .eq("exam_id", sessionData.exam_id);

        if (!answersError && !questionsError && examQuestions && examQuestions.length > 0) {
          let correctCount = 0;
          const mappedAnswers = examQuestions.map((q) => {
            const userAns = userAnswers?.find((a) => a.question_id === q.id);
            const selected = userAns ? userAns.selected_option : null;
            const isCorrect = selected !== null && selected === q.correct_option;
            if (isCorrect) correctCount++;

            return {
              question_text: q.question_text,
              options: Array.isArray(q.options) ? q.options : JSON.parse(q.options as any),
              correct_option: q.correct_option,
              selected_option: selected,
            };
          });

          const score = Math.round((correctCount / examQuestions.length) * 100);
          return {
            session_id: sessionId,
            user_id: sessionData.user_id,
            exam_id: sessionData.exam_id,
            submitted_at: sessionData.completed_at || new Date().toISOString(),
            answers: mappedAnswers,
            score,
            total_questions: examQuestions.length,
          };
        }
      }
    } catch (e) {
      console.warn("Error loading result from database:", e);
    }

    return null;
  },

  getStudentResults(userId: string): DBResult[] {
    const results = getLocalItem("synced_exam_results") as DBResult[];
    return results.filter((r) => r.user_id === userId);
  }
};
