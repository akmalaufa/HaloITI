"use client";

import { useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Mendaftarkan plugin ScrollTrigger ke mesin utama GSAP
gsap.registerPlugin(ScrollTrigger);

// Data 3 Fitur Utama (Bahan Bakunya)
const features = [
  {
    title: "Kampus Technopreneur ITI",
    description:
      "Institut Teknologi Indonesia membentuk lulusan berjiwa technopreneur, memadukan penguasaan teknologi dengan kemampuan berwirausaha.",
    image: "/feat-kampus.jpg",
  },
  {
    title: "Respons AI 24/7",
    description:
      "Tak perlu menunggu jam kerja. HaloITI siap menjawab pertanyaan seputar pendaftaran kapan pun, siang maupun malam.",
    image: "/feat-ai.jpg",
  },
  {
    title: "Informasi PMB Akurat",
    description:
      "Seluruh jawaban bersumber dari data resmi Penerimaan Mahasiswa Baru ITI, sehingga informasi yang kamu terima selalu tepat dan terpercaya.",
    image: "/feat-info.png", // Pakai format .png sesuai data di folder lu
  },
];

export function Features() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mesin Animasi Scroll
  useGSAP(() => {
    // Ngumpulin semua elemen baris (row) ke dalam array
    const rows = gsap.utils.toArray<HTMLElement>(".feature-row");

    rows.forEach((row) => {
      const imageWrapper = row.querySelector(".feature-image");
      const textWrapper = row.querySelector(".feature-text");

      // Animasi pelatuk: Bergerak pas layar nyentuh elemennya
      gsap.fromTo(
        [imageWrapper, textWrapper],
        { 
          y: 120, // Awalnya sembunyi 120 pixel di bawah
          opacity: 0 
        },
        {
          y: 0, // Naik ke posisi asli
          opacity: 1,
          duration: 1.5,
          ease: "power3.out",
          stagger: 0.2, // Gambar muncul duluan, selisih 0.2 detik baru teksnya nyusul
          scrollTrigger: {
            trigger: row,
            start: "top 85%", // Mulai gerak waktu pucuk elemen ngelewatin 85% layar bawah
            toggleActions: "play none none reverse", // Otomatis hilang lagi kalau di-scroll ke atas
          },
        }
      );
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative bg-[#0a0a0a] pt-32 pb-16 px-6 overflow-hidden">
      {/* Efek Gradasi Acak (Mesh Gradient / Glowing Orbs) - Oranye Pas (Sweet Spot) */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black calc(100% - 150px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 150px, black calc(100% - 150px), transparent 100%)'
        }}
      >
        <div className="absolute top-[0%] left-[-10%] w-[800px] h-[800px] rounded-full bg-brand/35 blur-[180px]" />
        <div className="absolute top-[40%] right-[-10%] w-[1000px] h-[1000px] rounded-full bg-brand/25 blur-[200px]" />
        <div className="absolute bottom-[5%] left-[5%] w-[800px] h-[800px] rounded-full bg-brand/30 blur-[180px]" />
      </div>
      
      <div className="relative z-10 mx-auto max-w-7xl flex flex-col gap-32">
        {features.map((feat, index) => {
          // Logika Zig-zag: Kalau urutannya ganjil (indeks 1), dibalik (reverse)
          const isEven = index % 2 !== 0;

          return (
            <div
              key={index}
              className={`feature-row flex gap-4 sm:gap-12 md:gap-24 items-center ${
                isEven ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* --- Blok Gambar --- */}
              <div className="feature-image w-1/2 relative h-[30vh] sm:h-[50vh] md:h-[70vh] overflow-hidden rounded-2xl shadow-2xl">
                <Image
                  src={feat.image}
                  alt={feat.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* --- Blok Teks --- */}
              <div className="feature-text w-1/2 flex flex-col justify-center">
                <h3 className="text-xl sm:text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 tracking-tight leading-tight pb-1 mb-2">
                  {feat.title}
                </h3>
                <p className="text-sm sm:text-lg md:text-xl text-brand leading-relaxed font-semibold">
                  {feat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}