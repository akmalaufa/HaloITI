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
  title: "HaloITI - Chatbot PMB ITI",
  description: "Asisten Cerdas Penerimaan Mahasiswa Baru ITI",
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