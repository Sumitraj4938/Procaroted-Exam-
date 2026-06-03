"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2 } from "lucide-react";
import { supabase, toSafeUUID } from "@/lib/supabase";
import { dbSync } from "@/lib/dbSync";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }
    
    setLoading(true);
    setError("");

    // --- GUARANTEED ACCESS FOR REQUESTED CREDENTIALS ---
    if (email === "sumitraj4938@gmail.com" && password === "Sumit@4938") {
      const targetId = toSafeUUID("student-mock-id");
      try {
        await supabase.from("users").upsert({
          id: targetId,
          email,
          password,
          role: "student",
          full_name: "Sumit Raj"
        }, { onConflict: "email" });
      } catch (err) {
        console.warn("Could not upsert Sumit Raj student profile to Supabase:", err);
      }

      setUser({ id: targetId, email, role: "student", fullName: "Sumit Raj" });
      router.push("/dashboard");
      return;
    }
    if (email === "sumitraj4939@gmail.com" && password === "Sumit@4939") {
      const targetId = toSafeUUID("admin-mock-id");
      try {
        await supabase.from("users").upsert({
          id: targetId,
          email,
          password,
          role: "admin",
          full_name: "Sumit Raj (Admin)"
        }, { onConflict: "email" });
      } catch (err) {
        console.warn("Could not upsert Sumit Raj admin profile to Supabase:", err);
      }

      setUser({ id: targetId, email, role: "admin", fullName: "Sumit Raj (Admin)" });
      router.push("/admin");
      return;
    }
    // ---------------------------------------------------

    try {
      const userData = await dbSync.authenticate(email, password);

      if (!userData) {
        setError("Invalid email or password.");
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

      // Route based on their actual role in the database
      if (userData.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <Card className="w-full max-w-md shadow-2xl border-white/20 bg-white/95 backdrop-blur-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center mb-4">
            <Image src="/logo.png" alt="Proctored Mode Online Exam Logo" width={100} height={100} className="rounded-full" />
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
              placeholder="student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white" 
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            Sign In
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
