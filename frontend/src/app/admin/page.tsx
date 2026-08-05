export const metadata = {
  title: "Admin Panel - HaloITI",
};

// export const dynamic = 'force-dynamic'; // Supaya Next.js nggak men-cache halaman ini secara statis
import Link from "next/link";
import SystemHealthCard from "@/components/SystemHealthCard";

async function getMetrics() {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/admin/metrics', { 
      cache: 'no-store',
      headers: {
        'X-API-Key': process.env.X_API_KEY || ''
      }
    });
    
    if (!res.ok) {
      console.error(`Backend returned ${res.status}`);
      throw new Error('Gagal menarik data');
    }
    
    const json = await res.json();
    return json.data;
  } catch (error) {
    console.error(error);
    return {
      total_leads: 0,
      total_chats: 0,
      avg_latency_ms: 0
    };
  }
}

function formatLatency(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} detik`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default async function AdminDashboardPage() {
  const metrics = await getMetrics();

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="rounded-xl bg-linear-to-r from-brand to-[#ff8c00] p-8 shadow-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Selamat Datang, Admin! 👋
        </h1>
        <p className="mt-2 text-white/90">
          Pantau seluruh aktivitas pendaftaran calon mahasiswa baru dan interaksi AI di sini.
        </p>
      </div>

      {/* Kartu Status Integritas Sistem (Sistem Detektif AI) */}
      <SystemHealthCard apiKey={process.env.X_API_KEY} />

      {/* Grid Kartu Metrik (Terhubung ke API) */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Kartu 1 */}
        <Link href="/admin/leads" className="flex flex-col items-center text-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-[1.02]">
          <span className="text-sm font-medium text-gray-400">Total Pendaftar (Leads)</span>
          <span className="text-4xl font-bold text-brand">
            {metrics.total_leads.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">Maba yang terdata di sistem</span>
        </Link>
        
        {/* Kartu 2 */}
        <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-400">Total Percakapan</span>
          <span className="text-4xl font-bold text-white">
            {metrics.total_chats.toLocaleString()}
          </span>
          <span className="text-xs text-gray-500">Interaksi dengan chatbot AI</span>
        </div>
        
        {/* Kartu 3 */}
        <div className="flex flex-col items-center text-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
          <span className="text-sm font-medium text-gray-400">Rata-rata Respon AI</span>
          <span className="text-4xl font-bold text-green-400">
            {formatLatency(metrics.avg_latency_ms)}
          </span>
          <span className="text-xs text-gray-500">Kecepatan rata-rata balasan bot</span>
        </div>
      </div>
    </div>
  );
}
