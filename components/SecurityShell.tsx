"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { 
  Laptop, 
  Smartphone, 
  Lock, 
  ShieldAlert, 
  ShieldCheck, 
  Download, 
  RefreshCw, 
  Activity, 
  AlertTriangle, 
  Maximize2, 
  Minimize2, 
  Info,
  CheckCircle,
  Clock,
  User,
  Power,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExamStore } from "@/store";

export default function SecurityShell({ children }: { children: React.ReactNode }) {
  const [deviceState, setDeviceState] = useState<{
    isLoading: boolean;
    isMobile: boolean;
    osName: string;
  }>({
    isLoading: true,
    isMobile: false,
    osName: "Windows Host x86_64",
  });

  const [isSecureBrowser, setIsSecureBrowser] = useState(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStep, setLaunchStep] = useState(0);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [focusViolationOccurred, setFocusViolationOccurred] = useState(false);
  const [violationCount, setViolationCount] = useState(0);

  const addWarning = useExamStore((state) => state.addWarning);

  // Detector
  useEffect(() => {
    const timer = setTimeout(() => {
      // Determine OS
      let detectedOS = "Windows Desktop";
      const userAgent = navigator.userAgent;
      
      if (userAgent.indexOf("Mac") !== -1) detectedOS = "macOS Client (Apple Silicon/Intel)";
      else if (userAgent.indexOf("X11") !== -1) detectedOS = "Debian Linux Developer Host";
      else if (userAgent.indexOf("Linux") !== -1) detectedOS = "Linux Secure OS Workspace";
      
      // Check if Mobile
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || window.innerWidth < 1024;

      setDeviceState({
        isLoading: false,
        isMobile: isMobileDevice,
        osName: detectedOS,
      });

      // Check if secure mode stored
      const isSimulated = localStorage.getItem("shivam_secure_browser_simulated") === "true";
      setIsSecureBrowser(isSimulated);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Monitor Window Unfocus & Tab switching to prevent cheating
  useEffect(() => {
    if (!isSecureBrowser) return;

    const handleVisibilityAndFocus = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) {
        setFocusViolationOccurred(true);
        setViolationCount((prev) => prev + 1);
        
        // Push actual severe warning into the useExamStore proctor logs!
        addWarning("Tab Switch / Window Unfocus Attempt Detected in Secure Browser", "critical");
        
        // Use browser synthesis to voice-alert
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const speech = new SpeechSynthesisUtterance("Violation recorded: Outside window switcher block activated.");
          speech.rate = 1.0;
          window.speechSynthesis.speak(speech);
        }
      }
    };

    window.addEventListener("blur", handleVisibilityAndFocus);
    document.addEventListener("visibilitychange", handleVisibilityAndFocus);

    // Disable copy-paste & right click
    const preventRightClick = (e: MouseEvent) => {
      e.preventDefault();
    };
    
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key === "c") || 
        (e.ctrlKey && e.key === "v") || 
        (e.ctrlKey && e.key === "r") || 
        e.key === "F5" || 
        e.key === "F12" ||
        (e.metaKey && e.key === "r")
      ) {
        e.preventDefault();
        addWarning("Restricted Hotkey Blocked", "high");
      }
    };

    document.addEventListener("contextmenu", preventRightClick);
    document.addEventListener("keydown", preventShortcuts);

    return () => {
      window.removeEventListener("blur", handleVisibilityAndFocus);
      document.removeEventListener("visibilitychange", handleVisibilityAndFocus);
      document.removeEventListener("contextmenu", preventRightClick);
      document.removeEventListener("keydown", preventShortcuts);
    };
  }, [isSecureBrowser, addWarning]);

  const startFakeDownload = (os: string) => {
    setIsDownloading(os);
    setDownloadProgress(0);
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDownloading(null);
          }, 800);
          return 100;
        }
        return prev + Math.floor(Math.random() * 8) + 4;
      });
    }, 150);
  };

  const runLauncherSimulation = () => {
    setIsLaunching(true);
    setLaunchStep(0);
    
    const steps = [
      "Establishing system port bridge validation...",
      "Scanning host environment memory partitions...",
      "Deploying high-frequency video feed streams check...",
      "Activating desktop keyboard shortcut hooking...",
      "Securing background process isolation check...",
      "Shivam Secure Browser handshaking verification: COMPLIANT ✅",
    ];

    const timer = setInterval(() => {
      setLaunchStep((prev) => {
        if (prev >= steps.length - 1) {
          clearInterval(timer);
          setTimeout(() => {
            setIsLaunching(false);
            setIsSecureBrowser(true);
            localStorage.setItem("shivam_secure_browser_simulated", "true");
          }, 1000);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
  };

  const handleExitSecureBrowser = () => {
    setIsSecureBrowser(false);
    localStorage.removeItem("shivam_secure_browser_simulated");
    setShowExitWarning(false);
  };

  if (deviceState.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Activity className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-400 font-mono text-sm">Validating device security credentials...</p>
      </div>
    );
  }

  // State 1: Mobile Device Blocked
  if (deviceState.isMobile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
          
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-500/10 p-4 rounded-full mb-6">
              <Smartphone className="w-16 h-16 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
              MOBILE ACCESS BLOCKED
            </h1>
            <p className="text-slate-400 text-sm mb-6 max-w-md">
              For integrity, secure proctoring, and video compliance checks, this online examination portal does not support mobile phones or tablets.
            </p>

            <div className="w-full bg-slate-950/80 rounded-xl p-5 border border-slate-800 text-left mb-6 font-mono text-xs text-slate-300 space-y-3">
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">SYSTEM CODES:</span>
                <span className="text-red-400 font-bold">STATE_INVALID_STRICT</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-2">
                <span className="text-slate-500">REQUIRED HARDWARE:</span>
                <span>Desktop PC / Laptop</span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">SYSTEM ARCHITECT:</span>
                <span className="text-blue-400 font-bold">Shivam Raj</span>
              </div>
            </div>

            <div className="text-slate-500 text-xs">
              Please login from your desktop computer with chrome/firefox or install the secure desktop browser build.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Prompt Secure App Download on PC
  if (!isSecureBrowser) {
    const stepsList = [
      "No tab or window switching allowed to search answers.",
      "Ensures camera and audio system check is active.",
      "Blocks key shortcuts including copy/paste and screenshot snaps.",
      "Deep AI facial recognition scanning checks for real-time validation is uninterrupted."
    ];

    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-y-auto">
        {/* Decorative Grid overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />

        <div className="w-full max-w-4xl bg-slate-900 border border-blue-500/20 rounded-3xl overflow-hidden shadow-2xl relative z-10 grid grid-cols-1 md:grid-cols-12">
          
          {/* Left panel info */}
          <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Image src="/logo.png" alt="Shivam Logo" width={36} height={36} className="bg-white rounded-full p-0.5" />
                <span className="text-sm font-semibold tracking-wide text-blue-400 uppercase">Shivam Raj Secure Systems</span>
              </div>

              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight mb-4">
                Secure Proctored Desktop Browser Required
              </h1>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                To initiate any security-certified exam on this portal, you must execute the assessment from within our dedicated client environment to prevent tab switching, unauthorized apps, and virtual machine assistance.
              </p>

              <div className="space-y-4 mb-8">
                {stepsList.map((step, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                    <div className="bg-blue-500/10 p-0.5 text-blue-400 mt-0.5 rounded-full shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <p className="text-xs text-slate-400 leading-normal">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Laptop className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400">Current OS: <b className="text-white font-medium">{deviceState.osName}</b></span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Build v2.4.0 • Authorized Portal</span>
            </div>
          </div>

          {/* Right panel interaction */}
          <div className="md:col-span-5 bg-slate-950 p-8 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800/60">
            <h2 className="text-lg font-bold text-white mb-4">Client Suite Installer</h2>

            <div className="space-y-3">
              {/* Windows Button */}
              <button 
                onClick={() => startFakeDownload("Windows")}
                disabled={isDownloading !== null || isLaunching}
                className="w-full flex items-center justify-between text-left p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all group disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Download for Windows</p>
                  <p className="text-xs text-slate-500">Shivam_Proctor_x64.msi (~48 MB)</p>
                </div>
                <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>

              {/* MacOS Button */}
              <button 
                onClick={() => startFakeDownload("macOS")}
                disabled={isDownloading !== null || isLaunching}
                className="w-full flex items-center justify-between text-left p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all group disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Download for macOS</p>
                  <p className="text-xs text-slate-500">Shivam_Proctor_Silicon.dmg (~52 MB)</p>
                </div>
                <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>

              {/* Linux Button */}
              <button 
                onClick={() => startFakeDownload("Linux")}
                disabled={isDownloading !== null || isLaunching}
                className="w-full flex items-center justify-between text-left p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 hover:border-blue-500/50 transition-all group disabled:opacity-50"
              >
                <div>
                  <p className="text-sm font-semibold text-white">Download for Linux OS</p>
                  <p className="text-xs text-slate-500">shivam_proctor_amd64.deb (~45 MB)</p>
                </div>
                <Download className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors shrink-0" />
              </button>
            </div>

            {/* Fake Download Progress animation overlays */}
            <AnimatePresence>
              {isDownloading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5"
                >
                  <div className="flex justify-between text-xs text-slate-400 font-mono mb-2">
                    <span>Downloading client for {isDownloading}...</span>
                    <span>{downloadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-150" style={{ width: `${downloadProgress}%` }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Launcher simulation trigger section */}
            <div className="mt-8 pt-6 border-t border-slate-900">
              <p className="text-[11px] text-center text-slate-500 mb-3 tracking-normal">
                Already installed or wish to evaluate? Initiate the secure sandbox simulation below.
              </p>

              <button
                onClick={runLauncherSimulation}
                disabled={isDownloading !== null || isLaunching}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm py-4 rounded-xl shadow-lg hover:shadow-blue-500/10 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isLaunching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
                {isLaunching ? "Connecting Security Protocol..." : "Launch Secure Sandbox Environment"}
              </button>
            </div>
          </div>
        </div>

        {/* Floating Launching Overlay indicator */}
        <AnimatePresence>
          {isLaunching && (
            <motion.div 
              style={{ zIndex: 9999 }}
              className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-full max-w-md bg-slate-900 border border-blue-500/30 rounded-2xl p-6 text-center shadow-2xl relative">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" />
                <Activity className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                
                <h3 className="text-white font-bold text-lg mb-1">SHIVAM CLIENT BRIDGE</h3>
                <p className="text-slate-400 text-xs mb-6">Securing client container and starting local virtual screen hook...</p>

                <div className="bg-slate-950 rounded-lg p-3 text-left border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-mono block mb-1">ACTIVITY DIARY:</span>
                  <div className="text-xs font-mono text-cyan-400 space-y-1 select-none">
                    <p className="line-clamp-1">{[
                      "Establishing system port bridge validation...",
                      "Scanning host environment memory partitions...",
                      "Deploying high-frequency video feed streams check...",
                      "Activating desktop keyboard shortcut hooking...",
                      "Securing background process isolation check...",
                      "Shivam Secure Browser handshaking verification: COMPLIANT ✅",
                    ][launchStep]}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // State 3: Secure Sandbox Client Simulated Shell
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden relative">
      {/* Simulation application border framework container */}
      <div className="bg-slate-900 border border-blue-500/40 rounded-lg shadow-2xl m-2 overflow-hidden flex-1 flex flex-col relative">
        
        {/* Title Bar styling like actual desktop application frame */}
        <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-800 text-slate-300 font-mono text-xs select-none relative z-20 shrink-0">
          <div className="flex items-center gap-3">
            {/* Fake Desktop Windows buttons */}
            <div className="flex gap-1.5 shrink-0">
              <div className="w-3 h-3 rounded-full bg-red-500/20 hover:bg-red-500/40 cursor-not-allowed flex items-center justify-center text-[8px] text-red-900">x</div>
              <div className="w-3 h-3 rounded-full bg-yellow-500/20 hover:bg-yellow-500/40 cursor-not-allowed text-[8px] text-yellow-900">-</div>
              <div className="w-3 h-3 rounded-full bg-green-500/20 hover:bg-green-500/40 cursor-not-allowed text-[8px] text-green-900">+</div>
            </div>

            <div className="w-[1px] h-4 bg-slate-800" />

            <div className="flex items-center gap-1.5 text-blue-400">
              <Lock className="w-3.5 h-3.5" />
              <span className="font-bold tracking-tight text-slate-200">SHIVAM SECURE CLIENT - ACTIVE</span>
              <span className="bg-blue-950/80 text-blue-400 border border-blue-500/30 text-[9px] px-1.5 rounded-full uppercase scale-90">Locked (v2.4.0)</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping shrink-0" />
                <span>Camera Sync: <b className="text-green-400">ACTIVE</b></span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span>Host: <b className="text-blue-400">PC/LAPTOP</b></span>
              </div>
            </div>

            <button 
              onClick={() => setShowExitWarning(true)}
              className="bg-red-950 text-red-400 border border-red-500/30 text-[10px] hover:bg-red-900 hover:text-white px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer font-bold shrink-0"
            >
              <Power className="w-3 h-3" />
              Exit Clean Sandbox
            </button>
          </div>
        </div>

        {/* Address & Protocol Bar */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-3 z-15 shrink-0 select-none">
          <div className="flex gap-2 text-slate-600 shrink-0">
            <span className="cursor-not-allowed">←</span>
            <span className="cursor-not-allowed">→</span>
            <RefreshCw className="w-3 h-3 text-slate-700 animate-none cursor-not-allowed" />
          </div>
          <div className="flex-1 bg-slate-950 border border-slate-800/80 rounded px-3 py-1 flex items-center gap-2 text-slate-400 text-xs">
            <Lock className="w-3 h-3 text-green-500" />
            <span className="text-[10px] sm:text-xs text-slate-500 font-mono tracking-wide truncate">
              secure-examination://shivam-raj/portal/exam-session
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 border border-indigo-500/20 px-2 py-0.5 rounded">
              Compliance: 100% Secure
            </span>
          </div>
        </div>

        {/* Web app container space */}
        <div className="flex-1 overflow-y-auto bg-transparent relative">
          {children}
        </div>
      </div>

      {/* Exit Warning Dialog */}
      <AnimatePresence>
        {showExitWarning && (
          <motion.div 
            style={{ zIndex: 10000 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl relative">
              <div className="bg-amber-500/10 p-3 rounded-full mb-4 w-fit mx-auto">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">CLOSE SECURE EXAMINATION APP?</h3>
              <p className="text-slate-400 text-xs mb-6 text-center leading-relaxed">
                If you exit the Shivam Secure Browser sandbox tool while in an active exam session, your session will immediately lock down and trigger an exam completion status with critical violations.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowExitWarning(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 rounded-lg transition-colors border border-slate-700"
                >
                  Cancel & Go Back
                </button>
                <button
                  onClick={handleExitSecureBrowser}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-xs font-semibold py-2.5 rounded-lg shadow-lg active:scale-95 transition-all"
                >
                  Confirm Exit Suite
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extreme Visual Alert for tab swapping */}
      <AnimatePresence>
        {focusViolationOccurred && (
          <motion.div 
            style={{ zIndex: 11000 }}
            className="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl p-8 shadow-2xl space-y-6 relative">
              <div className="absolute top-0 inset-x-0 h-1 bg-red-500" />
              
              <div className="bg-red-500/10 p-4 rounded-full mb-2 w-fit mx-auto">
                <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse" />
              </div>

              <div className="space-y-2">
                <h3 className="text-red-500 font-extrabold tracking-wider text-xl">
                  CLIENT INTEGRITY THREAT LOGGED
                </h3>
                <p className="text-white font-semibold text-sm">
                  Prohibited Activity: Unfocused Workspace
                </p>
                <p className="text-slate-400 text-xs max-w-sm mx-auto leading-relaxed">
                  The client browser sandbox detected outside window navigation or page unfocus at least <span className="text-red-400 font-bold">{violationCount}</span> time(s). 
                  Tab switching attempts are automatically tracked, captured, and timestamped to the administrative control center!
                </p>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/80 text-left space-y-2 font-mono text-[11px] text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">PROCTOR VIOLATION:</span>
                  <span className="text-red-400 font-bold">CRITICAL_OUTSIDE_WORKSPACE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">INTEGRITY STATE:</span>
                  <span className="text-amber-500 font-bold">SUSPICIOUS_BLUR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">AUDITED BY:</span>
                  <span className="text-blue-400 font-bold">Shivam AI Proctor Engine</span>
                </div>
              </div>

              <button
                onClick={() => setFocusViolationOccurred(false)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 rounded-xl shadow-lg hover:shadow-red-500/10 transition-all cursor-pointer"
              >
                Acknowledge Violation & Resume Locked Mode
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
