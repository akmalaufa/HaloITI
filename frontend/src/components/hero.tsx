"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline();

    // 1. Animasi Foto Background (Zoom in super pelan ala Cinematic SOMA)
    tl.from(imageRef.current, {
      scale: 1.1,
      duration: 3,
      ease: "power2.out",
    });

    // 2. Animasi Judul Utama (Muncul dari bawah)
    tl.from(
      titleRef.current,
      {
        y: 80,
        opacity: 0,
        duration: 1.2,
        ease: "power4.out",
      },
      "-=2.2" // Mulai lebih awal sebelum foto selesai zoom
    );

    // 3. Animasi Subjudul
    tl.from(
      subtitleRef.current,
      {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      },
      "-=0.9"
    );

    // 4. Animasi Tombol
    tl.from(
      buttonRef.current,
      {
        y: 20,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
      },
      "-=0.8"
    );
  }, { scope: containerRef });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    localStorage.setItem("pending_chat_query", query);
    router.push("/login");
  };

  return (
    <section
      ref={containerRef}
      className="relative flex h-dvh w-full items-center justify-center overflow-hidden"
    >
      {/* --- LAYER 1: Gambar Background Full Screen --- */}
      <div className="absolute inset-0 z-0 bg-[#0a0a0a]">
        <div className="absolute inset-0">
          <Image
            ref={imageRef}
            src="/bg-kampus.jpg"
            alt="Latar Belakang Kampus ITI"
            fill
            priority
            className="object-cover opacity-80"
          />
          {/* Kaca Film Gelap (Gradient Overlay) */}
          <div className="hero-gradient absolute inset-0 pointer-events-none" />
          
          {/* Trik Ilusi Optik: Menggantikan maskImage (Lebih ringan buat GPU) */}
          <div className="absolute inset-0 bg-linear-to-b from-transparent from-75% to-[#0a0a0a] pointer-events-none" />
        </div>
      </div>

      {/* --- LAYER 2: Konten Utama di Tengah --- */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center text-white mt-10">
        
        {/* Judul Raksasa */}
        <h1
          ref={titleRef}
          className="max-w-5xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1]"
        >
          Mari Rencanakan Kuliahmu di ITI <br className="hidden sm:block" />
          <span className="text-brand">Yuk Ngobrol sama <span className="text-white">HALO</span>ITI</span>
        </h1>
        
        {/* Subjudul */}
        <p
          ref={subtitleRef}
          className="mt-8 max-w-2xl text-balance text-base font-medium text-white/80 sm:text-lg"
        >
          Tanya apa saja soal pendaftaran, biaya, dan program studi di Institut Teknologi Indonesia. HaloITI hadir untuk memberikan informasi yang Anda butuhkan.
        </p>

        {/* Tombol Aksi / Input Form */}
        <div 
          ref={buttonRef}
          className="mt-10 flex w-full max-w-2xl flex-col items-center justify-center gap-4 sm:flex-row"
        >
          {session ? (
            <Link href="/chat">
              <Button
                size="lg"
                className="rounded-full bg-brand px-8 py-6 text-lg font-bold text-white shadow-[0_0_40px_-10px_rgba(231,120,23,0.5)] transition-all hover:scale-105 hover:bg-brand/90 hover:shadow-[0_0_60px_-15px_rgba(231,120,23,0.7)] border-0"
              >
                Lanjutkan Chat
              </Button>
            </Link>
          ) : (
            <form 
              onSubmit={handleSearchSubmit}
              className="relative flex w-full max-w-xl items-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 p-1.5 shadow-2xl transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/50"
            >
              <input
                type="text"
                placeholder="Tanya seputar pendaftaran, biaya, atau prodi..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent px-5 py-2 text-base sm:text-lg text-white placeholder-white/50 outline-none"
              />
              <button
                type="submit"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:bg-brand/90 hover:scale-105 transition-all shadow-[0_0_15px_rgba(231,120,23,0.5)] border-0"
              >
                <ArrowRight className="size-5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}