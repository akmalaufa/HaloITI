"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { User, Menu, LogOut, MessageSquare, Shield, ChevronDown } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function AdminNavbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Deteksi klik di luar dropdown untuk menutupnya otomatis
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Format judul berdasarkan URL
  let title = "Dashboard";
  if (pathname.includes("/leads")) title = "Buku Tamu (Leads)";
  if (pathname.includes("/chats")) title = "History Chat User/Camaba";
  if (pathname.includes("/knowledge")) title = "Manajemen Pengetahuan (DOCX)";
  if (pathname.includes("/pricing")) title = "Manajemen Biaya Studi & Prodi";
  if (pathname.includes("/users")) title = "Manajemen Akses Admin";

  return (
    <nav className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-[var(--color-brand)] px-6 shadow-md">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuClick}
          className="sm:hidden rounded-lg p-1 text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold text-white drop-shadow-sm">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Profil Admin Dropdown */}
        <div className="relative border-l border-white/10 pl-4" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 transition-all hover:opacity-80 focus:outline-none"
          >
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-medium text-white max-w-[150px] truncate">
                {session?.user?.name || "Admin ITI"}
              </span>
              <span className="text-xs text-white/70 max-w-[150px] truncate">
                {session?.user?.email || "admin@iti.ac.id"}
              </span>
            </div>
            
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white/10 text-gray-100 ring-2 ring-white/50 transition-transform duration-200">
              {session?.user?.image ? (
                <Image 
                  src={session.user.image} 
                  alt="Profile" 
                  width={40} 
                  height={40} 
                  className="object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <ChevronDown className={`h-4 w-4 text-white/70 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-56 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 z-50 overflow-hidden">
              <div className="border-b border-white/10 p-3 sm:hidden">
                <p className="text-sm font-medium text-white truncate">{session?.user?.name || "Admin ITI"}</p>
                <p className="text-xs text-gray-400 truncate">{session?.user?.email || "admin@iti.ac.id"}</p>
              </div>
              
              <div className="p-2 space-y-1">
                <Link 
                  href="/admin/users"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Shield className="h-4 w-4" />
                  Manajemen Akses
                </Link>
                <Link 
                  href="/chat"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <MessageSquare className="h-4 w-4" />
                  Kembali ke Chat
                </Link>
              </div>
              
              <div className="border-t border-white/10 p-2">
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
