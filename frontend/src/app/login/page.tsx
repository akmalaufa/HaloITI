"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [showTerms, setShowTerms] = useState(false);

  // Sapu bersih token lama setiap kali user mendarat di halaman login
  useEffect(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("chat_session_id");
  }, []);

  return (
    <div className="relative flex min-h-screen w-full bg-background overflow-hidden">
      
      {/* 1. GAMBAR KAMPUS (Hanya Kiri) */}
      <div className="absolute inset-y-0 left-0 hidden w-1/2 md:block">
        <Image
          src="/bg-kampus.jpg"
          alt="Kampus ITI"
          fill
          className="object-cover opacity-40"
          priority
        />
        {/* Fading agar gambar menyatu ke background hitam di sisi kanan */}
        <div className="absolute inset-y-0 right-0 w-3/4 bg-gradient-to-l from-background via-background/80 to-transparent" />
      </div>

      {/* 2. GRADASI AMBIENT KESELURUHAN */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-background/40 to-brand/20 pointer-events-none" />
      <div className="absolute inset-0 bg-brand/5 mix-blend-overlay pointer-events-none" />

      {/* 3. KONTEN KIRI (Teks & Logo) */}
      <div className="relative z-10 hidden w-1/2 flex-col justify-between p-10 md:flex">
        <div>
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity w-fit">
            <div className="relative size-10">
              <Image src="/logo-iti.png" alt="Logo ITI" fill className="object-contain" />
            </div>
            <span className="text-xl font-extrabold tracking-widest text-white uppercase">
              HALO<span className="text-brand">ITI</span>
            </span>
          </Link>
        </div>

        <div className="mt-auto max-w-md">
          <h2 className="text-3xl font-extrabold text-brand leading-tight">
            Asisten Cerdas Kampus Technopreneur ITI
          </h2>
          <p className="mt-4 text-white/70 font-medium">
            Temukan semua informasi seputar pendaftaran, program studi, dan biaya kuliah di Institut Teknologi Indonesia dengan cepat dan akurat.
          </p>
        </div>
      </div>

      {/* 4. KONTEN KANAN (Form Login) */}
      <div className="relative z-10 flex w-full items-center justify-center p-8 md:w-1/2">
        {/* Logo HaloITI Khusus Mobile (Sembunyi di PC) */}
        <div className="absolute left-8 top-8 md:hidden">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="relative size-8">
              <Image src="/logo-iti.png" alt="Logo ITI" fill className="object-contain" />
            </div>
            <span className="text-lg font-extrabold tracking-widest text-white uppercase">
              HALO<span className="text-brand">ITI</span>
            </span>
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col justify-center space-y-8">
          
          {/* Header Form */}
          <div className="flex flex-col space-y-2 text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              <span className="text-brand">Selamat</span> Datang
            </h1>
            <p className="text-sm text-white/60">
              Masuk untuk memulai percakapan dengan HaloITI.
            </p>
          </div>

          {/* Tombol Login Google */}
          <div className="grid gap-4">
            <Button 
              variant="outline" 
              onClick={() => signIn("google", { callbackUrl: "/chat" })}
              className="w-full rounded-xl py-6 border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold transition-all"
            >
              <svg className="mr-3 size-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Masuk dengan Google
            </Button>
          </div>

          <p className="px-8 text-center text-xs text-white/50">
            Dengan masuk, Anda menyetujui{" "}
            <button 
              onClick={() => setShowTerms(true)}
              className="underline underline-offset-4 hover:text-brand"
            >
              Syarat & Ketentuan
            </button>{" "}
            kami.
          </p>
          
        </div>
      </div>

      {/* 5. MODAL SYARAT & KETENTUAN */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Latar Belakang Blur */}
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowTerms(false)}
          />
          
          {/* Kotak Modal */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-br from-background via-background to-brand/30 p-8 shadow-2xl overflow-hidden">
            <h3 className="relative text-2xl font-bold text-white mb-6">Syarat & Ketentuan HaloITI</h3>
            
            <div className="relative space-y-5 text-sm text-white/70 max-h-[60vh] overflow-y-auto pr-4">
              <p>Selamat datang di layanan chatbot HaloITI (Asisten Cerdas Kampus Technopreneur ITI).</p>
              
              <div>
                <strong className="text-white block mb-1">1. Penggunaan Layanan</strong>
                Layanan ini ditujukan untuk mencari informasi umum seputar Penerimaan Mahasiswa Baru (PMB) ITI. Chatbot ini tidak terintegrasi dengan sistem akademik (SIAKAD) ataupun jadwal kuliah.
              </div>
              
              <div>
                <strong className="text-white block mb-1">2. Privasi Data</strong>
                Dengan menggunakan login Google, kami menyimpan informasi profil dasar (nama & email) Anda semata-mata untuk mengidentifikasi riwayat percakapan Anda. Data Anda aman dan tidak akan disebarluaskan.
              </div>
              
              <div>
                <strong className="text-white block mb-1">3. Kekeliruan AI & Batasan Sistem</strong>
                Sebagaimana sifat kecerdasan buatan, AI memiliki potensi untuk melakukan kesalahan atau memberikan informasi yang keliru. Harap dicatat bahwa chatbot ini hanya sebatas memberikan informasi tentang PMB ITI. Sistem ini tidak terintegrasi dengan pendaftaran otomatis, sehingga Anda tidak dapat melakukan aktivitas pendaftaran di sistem chatbot ini.
              </div>
            </div>

            <div className="relative mt-8 flex justify-end">
              <Button 
                onClick={() => setShowTerms(false)}
                className="bg-brand text-white hover:bg-brand/90 font-bold px-6 py-2"
              >
                Saya Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
