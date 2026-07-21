"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";

export function Navbar() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Deteksi scroll untuk mengubah wujud Navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Animasi GSAP: Navbar turun perlahan dari atas saat web dibuka
  useGSAP(() => {
    gsap.from(navRef.current, {
      y: -100,
      opacity: 0,
      duration: 1.2,
      ease: "power3.out",
    });
  }, []);

  return (
    <header
      ref={navRef}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 bg-transparent ${
        isScrolled ? "py-4" : "py-6"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
            {/* Logo ITI (Gambar) */}
          <div className="relative size-12 shrink-0">
            <Image
              src="/logo-iti.png" // PASTIKAN NAMA FILE INI SAMA DENGAN NAMA LOGO LU DI FOLDER PUBLIC
              alt="Logo ITI"
              fill
              className="object-contain"
            />
          </div>
          <span className="text-[10px] sm:text-sm font-extrabold tracking-widest sm:tracking-[0.2em] text-white uppercase w-[120px] sm:w-auto leading-tight">
            Institut Teknologi Indonesia
          </span>
        </div>

        {/* Tombol Masuk yang Elegan */}
        <Link href={session ? "/chat" : "/login"}>
          <Button
            size="lg"
            className="rounded-full bg-brand px-6 text-sm font-bold text-white hover:bg-brand/90 hover:scale-105 transition-transform border-0"
          >
            {session ? "Lanjutkan Chat" : "Mulai Percakapan"}
          </Button>
        </Link>
      </nav>
    </header>
  );
}