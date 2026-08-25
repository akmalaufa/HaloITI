import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Menarik font Plus Jakarta Sans dari Google
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HaloITI - Chatbot Pintar PMB Institut Teknologi Indonesia",
  description: "Tanya jawab seputar Penerimaan Mahasiswa Baru (PMB) Institut Teknologi Indonesia dengan cepat melalui asisten AI HaloITI.",
  keywords: ["HaloITI", "PMB ITI", "Institut Teknologi Indonesia", "Chatbot ITI", "Kampus ITI", "Pendaftaran ITI"],
  verification: {
    google: "iwSqVSooTZpoz3OtbDmvmbDY0LDpV_XkgmMoPVaKR24",
  },
  openGraph: {
    title: "HaloITI - Chatbot PMB ITI",
    description: "Asisten AI pintar untuk info PMB ITI.",
    url: "https://haloiti.akmalaufa.my.id",
    siteName: "HaloITI",
    locale: "id_ID",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} font-sans antialiased bg-background text-foreground relative`}
      >
        <Providers>
          {children}
          {/* Efek Tekstur Bintik (SOMA style) yang menyelimuti seluruh layar */}
          <div className="noise-overlay" />
        </Providers>
      </body>
    </html>
  );
}