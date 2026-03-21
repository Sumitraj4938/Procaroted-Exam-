import { create } from 'zustand';

type UserRole = 'student' | 'admin' | null;

interface User {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

export interface WarningDetail {
  id: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

interface ExamState {
  cheatingScore: number;
  warnings: WarningDetail[];
  addWarning: (warning: string, severity?: 'low' | 'medium' | 'high' | 'critical') => void;
  resetExamState: () => void;
  isExamActive: boolean;
  setExamActive: (active: boolean) => void;
}

export const useExamStore = create<ExamState>((set) => ({
  cheatingScore: 0,
  warnings: [],
  isExamActive: false,
  setExamActive: (active) => set({ isExamActive: active }),
  addWarning: (warning, severity = 'medium') => set((state) => {
    let scoreIncrease = 0;
    switch (severity) {
      case 'low': scoreIncrease = 5; break;
      case 'medium': scoreIncrease = 15; break;
      case 'high': scoreIncrease = 30; break;
      case 'critical': scoreIncrease = 50; break;
    }
    
    // Prevent duplicate warnings within a short time frame (simplified)
    if (state.warnings.length > 0 && state.warnings[0].message === warning) {
      const lastWarningTime = new Date(state.warnings[0].timestamp).getTime();
      if (Date.now() - lastWarningTime < 3000) {
        return state; // Ignore if same warning happened < 3 seconds ago
      }
    }

    // Trigger Text-to-Speech Announcement
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Cancel any ongoing speech to prioritize the new warning
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(`Warning: ${warning}. Please fix this immediately.`);
      msg.rate = 1.1;
      msg.pitch = 1.2;
      window.speechSynthesis.speak(msg);
    }

    const newWarning: WarningDetail = {
      id: Math.random().toString(36).substring(7),
      message: warning,
      severity,
      timestamp: new Date().toISOString(),
    };

    return {
      warnings: [newWarning, ...state.warnings].slice(0, 10), // Keep last 10 warnings
      cheatingScore: Math.min(100, state.cheatingScore + scoreIncrease),
    };
  }),
  resetExamState: () => set({ cheatingScore: 0, warnings: [], isExamActive: false }),
}));
