"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Shield } from "lucide-react";

// Tipe data untuk pesan obrolan

interface Message {

  id: string;

  role: "user" | "ai";

  content: string;

}



export default function ChatPage() {

  const { data: session } = useSession();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // State untuk Pop-up WhatsApp
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean>(false);
  const [inputWA, setInputWA] = useState<string>("");
  const [errorWA, setErrorWA] = useState<string>("");

  // State untuk Chat Arena
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<string>("");

  // State untuk Infinite Scroll
  const [offset, setOffset] = useState<number>(20);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [firstItemIndex, setFirstItemIndex] = useState<number>(10000); // Anchor rahasia Virtuoso

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus input setelah AI selesai mikir
  useEffect(() => {
    if (!isThinking && inputRef.current) {
      // Small timeout ensures focus happens after UI state fully unlocks
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isThinking]);

  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Paksa scroll ke bawah (untuk nampilin Footer/Reasoning Trace) saat AI mulai mikir
  useEffect(() => {
    if (isThinking && virtuosoRef.current && messages.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          align: 'end',
          behavior: 'smooth'
        });
      }, 50);
    }
  }, [isThinking, messages.length]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Cek apakah user adalah admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (session) {
        try {
          const res = await fetch("/api/admin/auth/check");
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(data.isAdmin);
          }
        } catch (error) {
          console.error("Gagal cek status admin", error);
        }
      }
    };
    checkAdmin();
  }, [session]);

  // Cek Auth dan Ambil History
  useEffect(() => {
    const initChat = async () => {
      if (typeof window === "undefined") return;

      try {
        // 1. Gunakan Session ID permanen (UUID statis) agar riwayat tidak hilang saat logout
        const chatSessionId = "00000000-0000-0000-0000-000000000000";

        // 2. Cek JWT Token
        let token = localStorage.getItem("access_token");

        // Fungsi untuk tarik riwayat
        const fetchHistory = async (jwt: string) => {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            // Meminta 20 pesan (10 pasang) mulai dari posisi terbaru (offset 0)
            const res = await fetch(`${apiUrl}/api/chat/history/${chatSessionId}?limit=20&offset=0`, {
              method: "GET",
              headers: { "Authorization": `Bearer ${jwt}` }
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.history && data.history.length > 0) {
                const historyMessages: Message[] = data.history.map((h: any, index: number) => ({
                  id: `history-${index}-${Date.now()}`,
                  role: h.role,
                  content: h.content.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")
                }));
                setMessages(historyMessages);
                setOffset(20);
                setHasMoreHistory(data.history.length === 20); // Kalau 20 (pas limit), mungkin masih ada. Kalau kurang, brarti udah abis.
              } else {
                setHasMoreHistory(false);
              }
            }
            return res.status;
          } catch (error) {
            console.error("Gagal menarik riwayat obrolan:", error);
            return 500;
          }
        };

        // Jika Token tidak ada, coba Silent Check
        if (!token) {
          try {
            const res = await fetch("/api/auth-leads", { method: "POST" });
            if (res.ok) {
              const data = await res.json();
              if (data.access_token) {
                token = data.access_token;
                localStorage.setItem("access_token", data.access_token);
                setHasWhatsApp(true);
                await fetchHistory(data.access_token);
              }
            }
          } catch (e) {
            console.error("Silent check error:", e);
          }
        } else {
          // Token ada, coba tarik riwayat
          setHasWhatsApp(true);
          const status = await fetchHistory(token);
          
          // Auto-Renew Token jika 401
          if (status === 401) {
            try {
              const renewRes = await fetch("/api/auth-leads", { method: "POST" });
              if (renewRes.ok) {
                const data = await renewRes.json();
                if (data.access_token) {
                  token = data.access_token;
                  localStorage.setItem("access_token", data.access_token);
                  await fetchHistory(data.access_token);
                } else {
                  // Jika Backend membalas 'need_whatsapp' (Berarti user udah kehapus di DB)
                  localStorage.removeItem("access_token");
                  signOut({ callbackUrl: '/' });
                }
              } else {
                // Jika Silent Check gagal (sesi Google habis)
                localStorage.removeItem("access_token");
                signOut({ callbackUrl: '/' });
              }
            } catch (e) {
              console.error("Auto-renew error:", e);
            }
          }
        }
      } finally {
        // Apapun hasilnya (sukses atau gagal), hentikan mode checking
        setIsCheckingAuth(false);
      }
    };

    initChat();
  }, []);

  // Real-time Check: Ping backend setiap 5 detik untuk cek status akun
  useEffect(() => {
    if (!hasWhatsApp) return;

    const checkAccountStatus = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const chatSessionId = "00000000-0000-0000-0000-000000000000";
        // Cukup minta 1 history untuk mancing error 401 kalau akun dihapus
        const res = await fetch(`${apiUrl}/api/chat/history/${chatSessionId}?limit=1&offset=0`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (res.status === 401) {
          localStorage.removeItem("access_token");
          signOut({ callbackUrl: '/' });
        }
      } catch (error) {
        // Abaikan error koneksi
      }
    };

    const intervalId = setInterval(checkAccountStatus, 5000);
    return () => clearInterval(intervalId);
  }, [hasWhatsApp]);

  // --- FUNGSI REVERSE INFINITE SCROLL ---
  const fetchOlderHistory = useCallback(async () => {
    if (!hasMoreHistory || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const chatSessionId = "00000000-0000-0000-0000-000000000000";
      let token = localStorage.getItem("access_token");
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/chat/history/${chatSessionId}?limit=20&offset=${offset}`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.history && data.history.length > 0) {
          const oldMessages: Message[] = data.history.map((h: any, index: number) => ({
            id: `history-old-${offset}-${index}-${Date.now()}`,
            role: h.role,
            content: h.content.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")
          }));
          
          setMessages(prev => [...oldMessages, ...prev]);
          setFirstItemIndex(prev => prev - oldMessages.length);
          setOffset(prev => prev + 20);
          
          if (data.history.length < 20) {
            setHasMoreHistory(false);
          }
        } else {
          setHasMoreHistory(false);
        }
      }
    } catch (error) {
      console.error("Gagal menarik data lama:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [offset, hasMoreHistory, isLoadingMore]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Simpan Nomor WA
  const handleSaveWA = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Potong angka 0 di depan jika user ngetik "08..."
    let cleanWA = inputWA;
    if (cleanWA.startsWith("0")) {
      cleanWA = cleanWA.substring(1);
    }

    // 2. Validasi kosong
    if (cleanWA.length === 0) {
      setErrorWA("Nomor WA tidak boleh kosong.");
      return;
    }

    // 3. Validasi awalan angka 8
    if (!cleanWA.startsWith("8")) {
      setErrorWA("Nomor HP Indonesia harus diawali angka 8 (setelah +62).");
      return;
    }

    // 4. Validasi panjang karakter (minimal 9 angka setelah +62)
    if (cleanWA.length < 9) {
      setErrorWA("Nomor WA terlalu pendek (minimal 9 angka).");
      return;
    }

    // 5. Tembak API auth-leads untuk JWT Token
    try {
      const res = await fetch("/api/auth-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_whatsapp: `+62${cleanWA}` })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("access_token", data.access_token);
          setHasWhatsApp(true);
          setErrorWA("");
          setInputWA(cleanWA);
        }
      } else {
        setErrorWA("Gagal verifikasi dari server.");
      }
    } catch (err) {
      setErrorWA("Terjadi kesalahan jaringan.");
    }
  };

  // Handle Kirim Pesan Chat (Streaming SSE)
  const executeChat = async (messageText: string) => {
    if (!messageText.trim() || isThinking) return;

    // 1. Masukkan pesan User
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };
    // Siapkan ID untuk pesan AI yang akan ditumpuk perlahan
    const newAiMsgId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, newUserMsg]);
    setInputValue("");

    // 2. Munculkan efek "AI is Thinking" dan Status Awal
    setIsThinking(true);
    setLiveStatus("Menghubungkan ke server...");

    // 3. Tembak API Backend (POST Streaming)
    try {
      let token = localStorage.getItem("access_token");
      const chatSessionId = "00000000-0000-0000-0000-000000000000";
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      let res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // Kunci satpam
        },
        body: JSON.stringify({
          session_id: chatSessionId,
          message: newUserMsg.content
        }),
        signal: abortController.signal
      });

      // Auto-Renew Token if 401 during Chat
      if (res.status === 401) {
        const renewRes = await fetch("/api/auth-leads", { method: "POST" });
        if (renewRes.ok) {
          const renewData = await renewRes.json();
          if (renewData.access_token) {
            token = renewData.access_token;
            localStorage.setItem("access_token", renewData.access_token);
            // Re-fetch chat API
            res = await fetch(`${apiUrl}/api/chat`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({
                session_id: chatSessionId,
                message: newUserMsg.content
              }),
              signal: abortController.signal
            });
          }
        }
      }

      if (!res.ok) {
        setIsThinking(false);
        setLiveStatus("");
        // Rollback: Hapus pesan user dari history & kembalikan ke input box
        setMessages((prev) => prev.filter((msg) => msg.id !== newUserMsg.id && msg.id !== newAiMsgId));
        setInputValue(newUserMsg.content);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) {
        setIsThinking(false);
        setLiveStatus("");
        setMessages((prev) => prev.filter((msg) => msg.id !== newUserMsg.id && msg.id !== newAiMsgId));
        setInputValue(newUserMsg.content);
        return;
      }

      let doneReading = false;
      let buffer = ""; // Menampung potongan teks JSON yang terputus

      while (!doneReading) {
        const { value, done } = await reader.read();
        
        // Selalu proses value terlebih dahulu jika ada, meskipun done bernilai true
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          
          // SSE memisahkan event dengan dua newline (\n\n)
          const parts = buffer.split("\n\n");
          
          // Simpan part terakhir yang mungkin belum selesai (belum ada \n\n) ke dalam buffer
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const jsonString = part.replace("data: ", "");
              try {
                const parsedData = JSON.parse(jsonString);
                
                if (parsedData.type === "status") {
                  setLiveStatus(parsedData.message);
                } else if (parsedData.type === "content_chunk") {
                  // Sembunyikan Reasoning Trace karena jawaban akhir sudah mulai diketik
                  setLiveStatus(""); 
                  // Tumpuk huruf ke layar (Typewriter Effect)
                  setMessages((prev) => {
                    const exists = prev.find(msg => msg.id === newAiMsgId);
                    if (exists) {
                      return prev.map((msg) => 
                        msg.id === newAiMsgId 
                          ? { ...msg, content: msg.content + parsedData.message }
                          : msg
                      );
                    } else {
                      return [...prev, { id: newAiMsgId, role: "ai", content: parsedData.message }];
                    }
                  });
                } else if (parsedData.type === "done") {
                  setLiveStatus("");
                  setIsThinking(false);
                }
              } catch (e) {
                console.error("Gagal mem-parsing serpihan JSON SSE:", e);
              }
            }
          }
        }

        if (done) {
          doneReading = true;
          break;
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User sengaja memencet tombol Stop, tidak perlu menampilkan error koneksi.
        return;
      }
      setIsThinking(false);
      setLiveStatus("");
      // Jika AI belum sempat ngetik apa-apa (pesan belum masuk atau masih kosong), kita rollback total
      setMessages((prev) => {
        const aiMsg = prev.find(msg => msg.id === newAiMsgId);
        if (!aiMsg || aiMsg.content.trim() === "") {
          setInputValue(newUserMsg.content); // Restore input hanya jika jawaban belum diketik
          return prev.filter((msg) => msg.id !== newUserMsg.id && msg.id !== newAiMsgId);
        }
        return prev;
      });
    } finally {
      // GARANSI 100%: Apapun yang terjadi (sukses, error, putus), selalu unlock UI!
      setIsThinking(false);
      setLiveStatus("");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeChat(inputValue);
  };

  // Auto-Trigger Pesan dari Landing Page
  useEffect(() => {
    if (hasWhatsApp && !isCheckingAuth && !isThinking) {
      const pendingQuery = localStorage.getItem("pending_chat_query");
      if (pendingQuery) {
        localStorage.removeItem("pending_chat_query");
        // Beri sedikit jeda agar DOM Chat Arena selesai dimuat
        setTimeout(() => {
          executeChat(pendingQuery);
        }, 300);
      }
    }
  }, [hasWhatsApp, isCheckingAuth, isThinking]);

  // Handle Stop Response
  const handleStopResponse = (e: React.MouseEvent) => {
    e.preventDefault();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // CABUT KABEL!
      abortControllerRef.current = null;
    }
    setIsThinking(false);
    setLiveStatus("");
    
    const stopMsg: Message = {
      id: Date.now().toString(),
      role: "ai",
      content: "You stopped this response",
    };
    setMessages((prev) => {
      // Hapus balon AI yang masih kosong (belum sempat ngetik) agar tidak jadi "Balon Hantu"
      const filtered = prev.filter(msg => !(msg.role === "ai" && msg.content.trim() === ""));
      return [...filtered, stopMsg];
    });
  };

  return (
    <div className="h-screen w-full bg-[#09090b] flex flex-col items-center relative overflow-hidden">
      
      {/* Latar Belakang Pendaran Oranye (Kiri Atas & Kanan Bawah) */}
      <div className="fixed top-0 left-0 w-full h-150 bg-linear-to-br from-brand/20 via-transparent to-transparent pointer-events-none opacity-60 z-110" />
      <div className="fixed -bottom-32 -right-32 w-125 h-125 bg-brand/15 blur-[140px] rounded-full pointer-events-none opacity-80 z-110" />
      
      {/* ---------------------------------------------------- */}
      {/* MODAL WAJIB WHATSAPP (Overlay) */}
      {/* ---------------------------------------------------- */}
      {!isCheckingAuth && !hasWhatsApp && (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#18181b] p-8 rounded-2xl shadow-2xl border border-white/10 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-300">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Verifikasi WhatsApp</h2>
              <p className="text-gray-400 text-sm">
                Sebelum memulai obrolan, mohon masukkan nomor WhatsApp Anda agar kami dapat mengirimkan info PMB lebih lanjut.
              </p>
            </div>

            <form onSubmit={handleSaveWA} className="space-y-4">
              <div>
                <div className="flex items-center w-full bg-[#27272a] rounded-xl border border-white/5 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand overflow-hidden transition-all">
                  <div className="flex items-center justify-center px-4 py-3 text-white bg-white/5 border-r border-white/5 font-medium">
                    +62
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    placeholder="8123456789"
                    value={inputWA}
                    onChange={(e) => setInputWA(e.target.value.replace(/\D/g, ""))}
                    className="flex-1 bg-transparent text-white px-4 py-3 outline-none placeholder:text-gray-500"
                  />
                </div>
                {errorWA && <p className="text-red-500 text-xs mt-2 text-left">{errorWA}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="w-full bg-[#27272a] hover:bg-[#3f3f46] text-white/80 font-medium py-3 rounded-xl transition-all border border-white/5"
                >
                  Batal Login
                </button>
                <button
                  type="submit"
                  className="w-full bg-brand hover:bg-brand/90 text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(231,120,23,0.3)] hover:shadow-[0_0_25px_rgba(231,120,23,0.5)]"
                >
                  Simpan & Mulai Chat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* HEADER (Full Width, Transparent) */}
      {/* ---------------------------------------------------- */}
      <header className={`fixed top-0 left-0 w-full h-20 flex items-center justify-between px-6 md:px-10 z-100 bg-[#09090b] transition-all duration-500 pointer-events-none ${(!isCheckingAuth && !hasWhatsApp) ? 'blur-sm opacity-50' : 'opacity-100'}`}>
        {/* Kiri: Logo HALOITI */}
        <Link href="/" className="flex items-center space-x-3 select-none pointer-events-auto hover:opacity-80 transition-opacity cursor-pointer">
          <img src="/favicon.ico" alt="Logo ITI" className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(231,120,23,0.3)] pointer-events-none" />
          <h1 className="text-[22px] font-bold tracking-wider">
            <span className="text-white">HALO</span><span className="text-brand">ITI</span>
          </h1>
        </Link>
        
        {/* Kanan: Nama Kampus & Profile */}
        <div className="flex items-center space-x-3 sm:space-x-6 pointer-events-auto">
          {/* Nama Kampus */}
          <div className="select-none text-white cursor-default opacity-90">
            {/* Desktop View: 1 baris lurus */}
            <div className="hidden sm:block text-xs sm:text-sm font-bold tracking-widest uppercase">
              Institut Teknologi Indonesia
            </div>
            
            {/* Mobile View: 3 baris rata kiri-kanan (justified sempurna) */}
            <div className="flex sm:hidden flex-col w-27.5 text-[10px] font-bold uppercase leading-[1.2]">
              <div className="flex justify-between w-full">
                {"INSTITUT".split("").map((char, i) => <span key={i}>{char}</span>)}
              </div>
              <div className="flex justify-between w-full">
                {"TEKNOLOGI".split("").map((char, i) => <span key={i}>{char}</span>)}
              </div>
              <div className="flex justify-between w-full">
                {"INDONESIA".split("").map((char, i) => <span key={i}>{char}</span>)}
              </div>
            </div>
          </div>
          
          {/* Avatar & Dropdown Menu */}
          <div className="relative" ref={profileMenuRef}>
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[#18181b] border border-white/10 hover:border-white/30 transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand/50 shadow-lg"
            >
              {session?.user?.image ? (
                <img src={session.user.image} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[13px] font-bold text-white">
                  {session?.user?.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                </span>
              )}
            </button>

            {/* Dropdown Box (Muncul saat diklik) */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <div className="px-4 py-3 border-b border-white/5 mb-1">
                  <p className="text-sm text-white font-medium truncate">{session?.user?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
                </div>
                
                {isAdmin && (
                  <Link 
                    href="/admin/leads"
                    className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    Dashboard Admin
                  </Link>
                )}
                
                <button 
                  onClick={() => {
                    setHasWhatsApp(false);
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  Ubah No. WhatsApp
                </button>
                <button 
                  onClick={() => {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("chat_session_id");
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Keluar akun
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------- */}
      {/* WATERMARK LOGO ITI (State 1 & 2) */}
      {/* ---------------------------------------------------- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden mt-10">
        <img 
          src="/favicon.ico" 
          alt="Watermark ITI" 
          className="w-75 h-75 md:w-112.5 md:h-112.5 object-contain opacity-[0.04] grayscale" 
        />
      </div>

      {/* ---------------------------------------------------- */}
      {/* CHAT ARENA (Hanya aktif jika hasWhatsApp = true) */}
      {/* ---------------------------------------------------- */}
      <div className={`absolute inset-0 flex flex-col w-full pt-20 transition-all duration-500 z-10 ${isCheckingAuth ? 'opacity-0' : (!hasWhatsApp ? 'blur-sm pointer-events-none select-none opacity-50' : 'opacity-100')}`}>

        {/* Daftar Pesan (Scrollable Full Width) */}
        <main className={`w-full relative z-10 ${
          messages.length === 0 ? "flex-none h-0 opacity-0 py-0" : "flex-1 min-h-0 opacity-100 transition-opacity duration-700 ease-in-out"
        }`}>
          {messages.length > 0 && (
            <Virtuoso
              ref={virtuosoRef}
              className="w-full h-full scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
              data={messages}
              firstItemIndex={firstItemIndex}
              followOutput="smooth"
              startReached={fetchOlderHistory}
              initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
              components={{
                Header: () => (
                  isLoadingMore ? (
                    <div className="w-full max-w-4xl mx-auto px-4 md:px-6 py-8 flex justify-center items-center">
                      <div className="flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2.5 h-2.5 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2.5 h-2.5 bg-brand rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  ) : null
                ),
                Footer: () => (
                  <div className="w-full max-w-4xl mx-auto px-4 md:px-6 pt-6 pb-6">
                    {(isThinking && liveStatus !== "") && (
                      <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-[#18181b] border border-brand/30 text-brand px-5 py-3.5 rounded-2xl rounded-tl-sm text-sm flex items-center space-x-3 shadow-[0_0_10px_rgba(231,120,23,0.1)]">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-brand rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-brand rounded-full animate-bounce"></div>
                          </div>
                          <span>{liveStatus}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              }}
              itemContent={(index, msg) => {
                if (msg.content === "You stopped this response") {
                  return (
                    <div className="w-full max-w-4xl mx-auto px-4 md:px-6">
                      <div className="w-full flex justify-center items-center py-2 opacity-60 animate-in fade-in duration-300">
                        <div className="h-px bg-white/20 flex-1"></div>
                        <span className="px-4 text-[13px] text-gray-400 font-medium tracking-wide">You stopped this response</span>
                        <div className="h-px bg-white/20 flex-1"></div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="w-full max-w-4xl mx-auto px-4 md:px-6 pt-6">
                    <div className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-500`}>
                      <div
                        className={`max-w-[95%] md:max-w-[85%] lg:max-w-3/4 px-4 md:px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                          msg.role === "user"
                            ? "bg-brand text-white rounded-tr-sm font-medium"
                            : "bg-[#27272a] text-gray-100 border border-white/5 rounded-tl-sm"
                        }`}
                      >
                        {msg.role === "user" ? (
                          msg.content.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                              p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                              table: ({node, ...props}) => (
                                <div className="w-full overflow-x-auto my-4 rounded-lg border border-zinc-800 shadow-lg scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                                  <table className="w-full text-sm text-left border-collapse" {...props} />
                                </div>
                              ),
                              thead: ({node, ...props}) => <thead className="bg-zinc-800/80 text-zinc-200 uppercase text-xs tracking-wider" {...props} />,
                              tbody: ({node, children, ...props}) => {
                                const rows = React.Children.toArray(children).filter(React.isValidElement);
                                
                                // Pass 1: Bikin matriks grid
                                const gridInfo = rows.map(tr => {
                                  const tds = React.Children.toArray(React.isValidElement(tr) ? (tr as any).props.children : []).filter(React.isValidElement);
                                  return tds.map(td => {
                                    const tdChildren = React.Children.toArray(React.isValidElement(td) ? (td as any).props.children : []);
                                    // Deteksi sel kosong (tidak ada child atau hanya string kosong/spasi)
                                    const isEmpty = tdChildren.length === 0 || 
                                                    (tdChildren.length === 1 && typeof tdChildren[0] === 'string' && tdChildren[0].trim().replace(/[\u200B-\u200D\uFEFF]/g, '') === '');
                                    return { td: td as React.ReactElement, isEmpty, rowSpan: 1, hide: false };
                                  });
                                });

                                // Pass 2: Hitung rowSpan
                                for (let c = 0; c < (gridInfo[0]?.length || 0); c++) {
                                  let spanStartRow = -1;
                                  for (let r = 0; r < gridInfo.length; r++) {
                                    if (!gridInfo[r][c]) continue; // Guard
                                    if (!gridInfo[r][c].isEmpty) {
                                      spanStartRow = r;
                                    } else if (spanStartRow !== -1) {
                                      gridInfo[spanStartRow][c].rowSpan += 1;
                                      gridInfo[r][c].hide = true;
                                    }
                                  }
                                }

                                // Pass 3: Rakit ulang baris tabel
                                const newRows = rows.map((tr, r) => {
                                  const newTds = gridInfo[r].map((cell) => {
                                    if (cell.hide) return null;
                                    if (cell.rowSpan > 1) {
                                      return React.cloneElement(cell.td as React.ReactElement<any>, { 
                                        rowSpan: cell.rowSpan, 
                                        className: ((cell.td as any).props.className || "") + " align-middle border-r border-zinc-700/50 text-center",
                                        style: { ...((cell.td as any).props.style || {}), textAlign: 'center' }
                                      });
                                    }
                                    return cell.td;
                                  }).filter(Boolean);
                                  return React.cloneElement(tr as React.ReactElement, {}, newTds);
                                });

                                return <tbody className="bg-zinc-900/50 divide-y divide-zinc-800" {...props}>{newRows}</tbody>;
                              },
                              tr: ({node, ...props}) => <tr className="hover:bg-zinc-800/40 transition-colors duration-200" {...props} />,
                              th: ({node, ...props}) => <th className="px-4 py-3 font-semibold border-b border-r border-zinc-700 last:border-r-0 text-center min-w-25" {...props} style={{ ...(props.style || {}), textAlign: 'center' }} />,
                              td: ({node, ...props}) => <td className="px-4 py-3 text-zinc-300 border-r border-zinc-700/50 last:border-r-0 text-center" {...props} style={{ ...(props.style || {}), textAlign: 'center' }} />,
                              ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="pl-1" {...props} />,
                              a: ({node, ...props}) => <a className="text-brand hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mt-5 mb-3" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-base font-semibold text-white mt-4 mb-2" {...props} />,
                              h4: ({node, ...props}) => <h4 className="text-[15px] font-semibold text-white mt-4 mb-2" {...props} />,
                              blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-brand/50 pl-3 italic text-gray-300 my-3 bg-white/5 py-1 pr-2 rounded-r" {...props} />,
                            }}
                          >
                            {msg.content.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          )}
        </main>

        {/* Kotak Ketik Input (Transisi dari Tengah ke Bawah) */}
        <div className={`w-full flex flex-col items-center px-4 md:px-6 ${
          messages.length === 0 
            ? "flex-1 justify-center pb-12" 
            : "flex-none pt-2 pb-4 md:pb-6"
        }`}>
          
          {/* Teks Sambutan (Hanya muncul saat kosong) */}
          {messages.length === 0 && (
            <div className="mb-8 text-center animate-in fade-in zoom-in duration-700">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                <span className="text-white">Halo {session?.user?.name ? session.user.name.split(" ")[0] : ""},</span>{" "}
                <span className="text-brand drop-shadow-[0_0_15px_rgba(231,120,23,0.2)]">ada yang bisa dibantu?</span>
              </h2>
              <p className="text-gray-400 mt-3 max-w-md mx-auto">
                Tanyakan seputar pendaftaran mahasiswa baru, jalur masuk, atau informasi kampus ITI.
              </p>
            </div>
          )}

          <div className={`w-full transition-all duration-700 ease-in-out ${messages.length === 0 ? "max-w-2xl" : "max-w-4xl"}`}>
            <form
              onSubmit={handleSendMessage}
              className="flex items-end gap-3 bg-[#18181b] border border-white/10 p-2 rounded-3xl shadow-lg focus-within:border-brand/50 focus-within:ring-1 focus-within:ring-brand/30 transition-all"
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={isThinking ? "Menunggu respons..." : "Tanyakan seputar pendaftaran ITI..."}
                maxLength={400}
                disabled={isThinking}
                className="flex-1 max-h-32 min-h-11 bg-transparent text-white px-4 py-2.5 resize-none outline-none placeholder:text-gray-500 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
              {isThinking ? (
                <button
                  type="button"
                  onClick={handleStopResponse}
                  className="h-11 w-11 shrink-0 rounded-full bg-[#27272a] hover:bg-[#3f3f46] flex items-center justify-center text-white transition-colors border border-white/10"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="h-11 w-11 shrink-0 rounded-full bg-brand hover:bg-brand/90 disabled:bg-[#27272a] disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                >
                  {/* Ikon panah kirim sederhana (SVG) */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              )}
            </form>
            <div className="text-center mt-3">
              <span className="text-[11px] text-gray-500">
                HaloITI dapat membuat kesalahan. Harap periksa kembali informasi penting.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

