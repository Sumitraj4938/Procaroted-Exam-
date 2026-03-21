"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, User, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (role: "student" | "admin") => {
    if (!email) {
      setError("Please enter an email address.");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      // Query Supabase for the user
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('role', role)
        .single();

      if (fetchError || !userData) {
        setError(`No ${role} found with this email. Try: ${role}@example.com`);
        setLoading(false);
        return;
      }

      // Set user in global store
      setUser({
        id: userData.id,
        email: userData.email,
        role: userData.role,
        fullName: userData.full_name || userData.email.split('@')[0],
      });

      if (role === "student") {
        router.push("/dashboard");
      } else {
        router.push("/admin");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="text-center">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">AI Proctored Exam</CardTitle>
          <CardDescription className="text-slate-500">Secure, intelligent, and fair online assessments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              type="email"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="student@example.com or admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin("student")}
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={() => handleLogin("student")}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            Login as Student
          </Button>
          <Button 
            variant="outline" 
            className="w-full flex items-center gap-2 border-slate-300 text-slate-700 hover:bg-slate-50" 
            onClick={() => handleLogin("admin")}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Login as Admin
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
