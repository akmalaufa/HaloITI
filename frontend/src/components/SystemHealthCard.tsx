'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

type Issue = {
  target: string;
  type: string;
  reason: string;
  action: string;
};

type HealthData = {
  is_healthy: boolean;
  issues: Issue[];
  metrics: {
    sql_docs: number;
    storage_files: number;
    sql_chunks: number;
    pinecone_vectors: number;
    bm25_ready: boolean;
  };
};

export default function SystemHealthCard({ apiKey }: { apiKey?: string }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetLogs, setResetLogs] = useState<any[]>([]);

  // Auto-scroll ke bawah saat ada log baru
  useEffect(() => {
    const end = document.getElementById("log-end");
    if (end) end.scrollIntoView({ behavior: "smooth" });
  }, [resetLogs]);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/knowledge/health`, {
        headers: {
          'X-API-Key': apiKey || ''
        }
      });

      if (!res.ok) {
        throw new Error(`Server merespon dengan status ${res.status}`);
      }

      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err.message || 'Gagal terhubung ke server validasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleHardReset = async () => {
    setShowResetModal(true);
    setIsResetting(true);
    setResetProgress(0);
    setResetLogs([]);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/knowledge/hard-reset`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey || '' }
      });
      
      if (!res.ok) throw new Error("Gagal mengeksekusi Hard Reset");
      if (!res.body) throw new Error("Body response kosong");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split("\n").filter(l => l.trim() !== "");
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              setResetProgress(parsed.progress);
              setResetLogs(prev => [...prev, parsed]);
            } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      setResetLogs(prev => [...prev, { status: "error", message: err.message || "Terjadi kesalahan" }]);
    } finally {
      setIsResetting(false);
      checkHealth(); // Refresh status setelah reset selesai
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🛡️ System Integrity Dashboard
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Pusat kendali untuk memvalidasi sinkronisasi data antara SQL, Cloud Storage, dan Memori AI Pinecone.
          </p>
        </div>
        <button
          onClick={checkHealth}
          disabled={loading || isResetting}
          className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Memvalidasi...
            </>
          ) : (
            <>
              <span>🔍</span> Cek Integritas Sistem
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400 font-medium">⚠️ {error}</p>
        </div>
      )}

      {data && (
        <div className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {data.is_healthy ? (
            <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-5 flex items-start gap-4">
              <div className="text-3xl">✅</div>
              <div>
                <h3 className="text-green-400 font-bold text-lg">All Systems Synced!</h3>
                <p className="text-sm text-green-300/80 mt-1">
                  Seluruh arsitektur sistem dalam keadaan sempurna. Tidak ada data yang hilang atau tertinggal.
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 border border-green-500/30">
                    📄 {data.metrics.sql_docs} Dokumen Tersinkronisasi
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300 border border-green-500/30">
                    🧠 {data.metrics.sql_chunks} Vektor AI Aktif
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-5 flex flex-col sm:flex-row items-start gap-4 justify-between">
                <div className="flex items-start gap-4">
                  <div className="text-3xl">❌</div>
                  <div>
                    <h3 className="text-red-400 font-bold text-lg">Ingatan AI Tidak Sinkron dengan Dokumen Aktif!</h3>
                    <p className="text-sm text-red-300/80 mt-1 max-w-2xl">
                      Ditemukan sisa ingatan dari dokumen yang sebelumnya gagal dihapus secara sempurna (kemungkinan karena koneksi terputus). 
                      Hal ini bisa membuat AI menjawab menggunakan informasi usang.
                    </p>
                    <p className="text-sm font-semibold text-yellow-300 mt-2">
                      Harap tekan tombol "Bersihkan & Sinkronisasi Ulang Ingatan AI" di samping untuk mengosongkan dan menyalin ulang seluruh ingatan AI.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleHardReset}
                  className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] hover:bg-red-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  ⚠️ Bersihkan & Sinkronisasi Ulang Ingatan AI
                </button>
              </div>

              {/* Daftar Anomali / Tersangka */}
              <div className="space-y-3">
                {data.issues.map((issue, idx) => (
                  <div key={idx} className="rounded-lg border border-red-500/30 bg-[#1a0f0f] p-4 shadow-inner relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <div className="ml-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-red-500/20 text-red-400 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-red-500/20">
                          {issue.type}
                        </span>
                        <span className="font-semibold text-white font-mono text-sm">{issue.target}</span>
                      </div>
                      <p className="text-sm text-gray-300 mb-2 leading-relaxed">
                        <span className="font-semibold text-red-300">Alasan:</span> {issue.reason}
                      </p>
                      <p className="text-sm text-yellow-300/90 leading-relaxed bg-yellow-500/10 px-3 py-2 rounded-md border border-yellow-500/20">
                        💡 <span className="font-semibold">Tindakan:</span> Tombol "Bersihkan Ingatan AI" di atas akan menyelesaikan masalah ini secara otomatis.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Real-time Progress (Streaming) */}
      {showResetModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl rounded-2xl bg-[#111] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-white/5 p-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${!isResetting || resetProgress === 100 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                  {!isResetting || resetProgress === 100 
                    ? "Proses Selesai!" 
                    : "Mereset & Sinkronisasi Ulang Ingatan AI..."}
                </h3>
                <span className="text-sm font-mono text-gray-400">{resetProgress}%</span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ease-out ${!isResetting || resetProgress === 100 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${resetProgress}%` }}
                />
              </div>
            </div>

            {/* Terminal Logs */}
            <div className="bg-[#0a0a0a] p-6 h-64 overflow-y-auto font-mono text-xs text-gray-400 flex flex-col gap-2 scroll-smooth">
              {resetLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-500/50 select-none">{">"}</span>
                  <span className={log.message?.includes("Selesai") || log.message?.includes("berhasil") ? "text-green-400 font-bold" : log.status === "error" || log.message?.includes("Gagal") ? "text-red-400" : "text-gray-300"}>
                    <span className="text-gray-500 mr-2">[{log.progress || 0}%]</span> {log.message}
                  </span>
                </div>
              ))}
              <div id="log-end" />
            </div>

            {/* Footer Action */}
            {!isResetting || resetProgress === 100 ? (
              <div className="border-t border-white/5 p-4 flex justify-end bg-[#111]">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="rounded-lg bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <div className="border-t border-white/5 p-4 flex justify-center bg-[#111]">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <svg className="h-3 w-3 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Harap jangan menutup jendela ini selama proses berlangsung
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
