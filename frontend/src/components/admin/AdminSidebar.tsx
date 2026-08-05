"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  FileText, 
  Calculator, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield
} from "lucide-react";
import Image from "next/image";

export default function AdminSidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (val: boolean) => void }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Beranda", href: "/admin", icon: LayoutDashboard },
    { name: "Buku Tamu", href: "/admin/leads", icon: Users },
    { name: "Riwayat Chat", href: "/admin/chats", icon: MessageSquare },
    { name: "Pengetahuan (DOCX)", href: "/admin/knowledge", icon: FileText },
    { name: "Biaya Studi, Periode Pendaftaran, dan Prodi", href: "/admin/pricing", icon: Calculator },
    { name: "Manajemen Admin", href: "/admin/users", icon: Shield },
  ];

  const handleNavClick = () => {
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  return (
    <aside 
      className={`fixed left-0 top-0 z-40 h-screen border-r-4 border-brand bg-[#0a0a0a] transition-all duration-300 ease-in-out ${
        isOpen 
          ? "translate-x-0 w-64" 
          : "-translate-x-full sm:translate-x-0 sm:w-20"
      }`}
    >
      <div className="flex h-full flex-col overflow-y-auto px-3 py-4 overflow-x-hidden">
        
        {/* LOGO & TOGGLE BUTTON */}
        <div className={`mb-8 mt-2 flex items-center px-2 ${isOpen ? "justify-between" : "flex-col justify-center gap-6"}`}>
          <Link href="/chat" title="Kembali ke Chat" className="flex items-center gap-2 transition-transform hover:scale-105">
            <Image 
              src="/favicon.ico" 
              alt="Logo ITI" 
              width={isOpen ? 40 : 36} 
              height={isOpen ? 40 : 36} 
              className="object-contain transition-all"
            />
            {isOpen && (
              <span className="text-xl font-bold tracking-tight text-white whitespace-nowrap animate-in fade-in duration-300">
                Admin Panel
              </span>
            )}
          </Link>
          
          <button 
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Sembunyikan Menu" : "Tampilkan Menu"}
            className={`rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white ${
              !isOpen && "mt-2"
            }`}
          >
            {isOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>

        {/* NAVIGATION */}
        <ul className="space-y-2 font-medium">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  title={!isOpen ? item.name : undefined}
                  className={`group flex items-center rounded-lg p-3 text-sm transition-all duration-300 ${
                    isActive
                      ? "bg-brand/10 text-brand"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  } ${!isOpen && "justify-center"}`}
                >
                  <Icon 
                    className={`h-5 w-5 shrink-0 transition-colors ${
                      isActive ? "text-brand" : "text-gray-400 group-hover:text-white"
                    }`} 
                  />
                  {isOpen && (
                    <span className="ml-3 whitespace-normal wrap-break-word leading-snug animate-in fade-in duration-300">
                      {item.name}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute left-0 h-8 w-1 rounded-r-md bg-brand shadow-[0_0_10px_rgba(231,120,23,0.8)]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* LOGOUT BUTTON */}
        <div className="mt-auto border-t-4 border-brand pt-4">
          <button 
            onClick={() => signOut({ callbackUrl: "/" })}
            title={!isOpen ? "Keluar" : undefined}
            className={`group flex w-full items-center rounded-lg p-3 text-sm text-gray-400 transition-all hover:bg-red-500/10 hover:text-red-500 ${
              !isOpen && "justify-center"
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {isOpen && (
              <span className="ml-3 whitespace-nowrap animate-in fade-in duration-300">Keluar</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
