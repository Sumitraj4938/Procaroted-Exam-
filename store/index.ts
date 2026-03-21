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

interface ExamState {
  cheatingScore: number;
  warnings: string[];
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
    if (state.warnings.length > 0 && state.warnings[0] === warning) {
      return state;
    }

    return {
      warnings: [warning, ...state.warnings].slice(0, 5), // Keep last 5 warnings
      cheatingScore: Math.min(100, state.cheatingScore + scoreIncrease),
    };
  }),
  resetExamState: () => set({ cheatingScore: 0, warnings: [], isExamActive: false }),
}));
