"use client";

import { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminNavbar from "./AdminNavbar";

export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Otomatis buka sidebar di layar besar (Desktop) setelah mount
  useEffect(() => {
    if (window.innerWidth >= 640) {
      setIsSidebarOpen(true);
    }
  }, []);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      {/* Konten Utama: Padding hanya berlaku di mode Desktop (sm:), di mode Mobile (tanpa sm:) padding tetap 0 */}
      <div 
        className={`relative flex h-screen w-full flex-col transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "sm:pl-64" : "sm:pl-20"
        }`}
      >
        <AdminNavbar onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
