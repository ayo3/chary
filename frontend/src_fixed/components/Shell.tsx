"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

export default function Shell({ children, rate }: { children: React.ReactNode; rate?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col">
      <TopNav sidebarOpen={open} onToggleSidebar={() => setOpen(!open)} rate={rate} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={open} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
