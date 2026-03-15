"use client";
import { Activity, Bell, Settings, Menu, X, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface TopNavProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  rate?: number;
}

export default function TopNav({ sidebarOpen, onToggleSidebar, rate }: TopNavProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString("en-GB"));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-14 bg-[#080f1e] border-b border-[#1a2744] flex items-center px-4 gap-4 flex-shrink-0 z-20 sticky top-0">
      <button onClick={onToggleSidebar} className="text-[#4a6fa5] hover:text-white transition-colors">
        {sidebarOpen ? <X size={17} /> : <Menu size={17} />}
      </button>

      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center">
          <Activity size={13} className="text-white" />
        </div>
        <span className="font-black text-sm tracking-tight text-white">
          FX RISK <span className="text-[#3b82f6]">INTELLIGENCE</span>
        </span>
      </div>

      {rate && (
        <div className="hidden md:flex items-center gap-1.5 ml-3 px-3 py-1 rounded-lg bg-[#0d1525] border border-[#1a2744]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-[#4a6fa5] font-mono">
            LIVE · USD/NGN · ₦{rate.toFixed(2)}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-3">
        <span className="text-[10px] text-[#4a6fa5] font-mono hidden sm:block">{time}</span>
        <button className="w-8 h-8 rounded-lg bg-[#0d1525] border border-[#1a2744] flex items-center justify-center text-[#4a6fa5] hover:text-white transition-colors">
          <Bell size={13} />
        </button>
        <button className="w-8 h-8 rounded-lg bg-[#0d1525] border border-[#1a2744] flex items-center justify-center text-[#4a6fa5] hover:text-white transition-colors">
          <Settings size={13} />
        </button>
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#6366f1] flex items-center justify-center text-[10px] font-black">
          FX
        </div>
      </div>
    </header>
  );
}
