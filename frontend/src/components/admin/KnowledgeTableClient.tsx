"use client";

import React, { useState, useEffect } from "react";
import { Upload, Trash2, FileText, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";

type KnowledgeDoc = {
  id: string;
  nama_dokumen: string;
  file_url: string;
  nama_file_asli?: string;
  updated_at: string;
};

export default function KnowledgeTableClient() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // State untuk Streaming Progress
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLogs, setUploadLogs] = useState<string[]>([]);
  const [isUploadSuccess, setIsUploadSuccess] = useState(false);
  const [actionType, setActionType] = useState<"upload" | "delete">("upload");

  // State untuk Custom Confirm Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<{ id: string; nama: string } | null>(null);

  const fetchDocs = async () => {
    setIsLoadingData(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/admin/knowledge/dokumen", {
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" }
      });
      if (res.ok) {
        const json = await res.json();
        setDocs(json.data || []);
      }
    } catch (error) {
      console.error("Gagal menarik data dokumen:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  // Efek untuk auto-scroll terminal log
  useEffect(() => {
    const el = document.getElementById("log-end");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [uploadLogs]);

  // Fungsi Upload & Update Dokumen (Terintegrasi ke Backend secara Streaming)
  const handleUploadClick = (idUpdate?: string) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".docx";
    fileInput.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        setIsUploading(true);
        // Reset state modal stream
        setActionType("upload");
        setUploadProgress(0);
        setUploadLogs([]);
        setIsUploadSuccess(false);
        setShowProgressModal(true);

        const formData = new FormData();
        formData.append("file", file);
        if (idUpdate) {
          formData.append("id_dokumen_update", idUpdate);
        }

        try {
          const res = await fetch("http://127.0.0.1:8000/api/admin/knowledge/upload", {
            method: "POST",
            headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" },
            body: formData,
          });

          if (!res.body) {
            throw new Error("Browser tidak mendukung ReadableStream");
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let partialData = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            partialData += decoder.decode(value, { stream: true });
            const lines = partialData.split("\n");

            // Baris terakhir mungkin belum komplit (potongan JSON)
            partialData = lines.pop() || "";

            for (const line of lines) {
              if (line.trim() !== "") {
                try {
                  const data = JSON.parse(line);
                  
                  // Update state UI
                  setUploadProgress(data.progress);
                  setUploadLogs((prev) => [...prev, data.message]);

                  if (data.status === "error") {
                    setIsUploading(false);
                    return; // Berhenti jika error dari server
                  }
                  
                  if (data.status === "success") {
                    setIsUploadSuccess(true);
                  }
                } catch (parseErr) {
                  console.error("Gagal parse JSON chunk:", line);
                }
              }
            }
          }
        } catch (error) {
          console.error("Upload stream error:", error);
          setUploadLogs((prev) => [...prev, `[Error Sistem] Gagal terhubung atau stream terputus: ${error}`]);
        } finally {
          setIsUploading(false);
        }
      }
    };
    fileInput.click();
  };

  // Fungsi Hapus Dokumen (Terintegrasi ke Backend Streaming)
  const handleDownload = async (id: string, namaFileAsli: string) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/knowledge/dokumen/${id}/download`, {
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" }
      });
      
      if (!res.ok) throw new Error("Gagal mengunduh file");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFileAsli;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      alert("Gagal mengunduh dokumen. Pastikan server aktif.");
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    setShowDeleteConfirm(false);
    setIsUploading(true); // Gunakan flag ini agar tombol tabel lain terkunci
    
    // Reset state modal stream untuk keperluan DELETE
    setActionType("delete");
    setUploadProgress(0);
    setUploadLogs([]);
    setIsUploadSuccess(false);
    setShowProgressModal(true);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/knowledge/dokumen/${id}`, {
        method: "DELETE",
        headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" }
      });

      if (!res.body) {
        throw new Error("Browser tidak mendukung ReadableStream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let partialData = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partialData += decoder.decode(value, { stream: true });
        const lines = partialData.split("\n");
        partialData = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() !== "") {
            try {
              const data = JSON.parse(line);
              
              setUploadProgress(data.progress);
              setUploadLogs((prev) => [...prev, data.message]);

              if (data.status === "error") {
                setIsUploading(false);
                return;
              }
              
              if (data.status === "success") {
                setIsUploadSuccess(true);
              }
            } catch (parseErr) {
              console.error("Gagal parse JSON chunk:", line);
            }
          }
        }
      }
    } catch (error) {
      console.error("Delete stream error:", error);
      setUploadLogs((prev) => [...prev, `[Error Sistem] Gagal terhubung atau stream terputus: ${error}`]);
    } finally {
      setIsUploading(false);
    }
  };

  // Fungsi format tanggal sederhana
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date) + " WIB";
  };

  return (
    <div className="flex flex-col gap-4">
      
      {/* Modal Notifikasi Sukses */}
      {showSuccessModal && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 rounded-lg bg-green-500/20 px-4 py-3 text-green-400 shadow-lg ring-1 ring-green-500/50 backdrop-blur-md transition-all animate-in slide-in-from-right-4 fade-in">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Sukses!</p>
            <p className="text-xs text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Delete */}
      {showDeleteConfirm && docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-[#111] border border-red-500/30 shadow-2xl overflow-hidden p-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-500">
              <Trash2 className="h-8 w-8" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-white">Hapus Dokumen?</h3>
            <p className="mb-6 text-sm text-gray-400">
              Apakah lu yakin ingin menghapus <strong>"{docToDelete.nama}"</strong>? Ini akan menghapus file fisik, record database, dan juga menghapus memori vektor AI. Tindakan ini tidak bisa dibatalkan!
            </p>
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                Batal
              </button>
              <button 
                onClick={() => handleDelete(docToDelete.id, docToDelete.nama)}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-500"
              >
                Ya, Hapus!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Real-time Progress (Streaming) */}
      {showProgressModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl rounded-2xl bg-[#111] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="border-b border-white/5 p-6 pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isUploadSuccess || uploadProgress === 0 ? 'bg-green-500' : 'bg-brand animate-pulse'}`} />
                  {isUploadSuccess 
                    ? "Proses Selesai!" 
                    : actionType === "upload" 
                      ? "Menyuntikkan Pengetahuan ke AI..." 
                      : "Menghapus Pengetahuan dari AI..."}
                </h3>
                <span className="text-sm font-mono text-gray-400">{uploadProgress}%</span>
              </div>
              {/* Progress Bar */}
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>

            {/* Terminal Logs */}
            <div className="bg-[#0a0a0a] p-6 h-64 overflow-y-auto font-mono text-xs text-gray-400 flex flex-col gap-2 scroll-smooth">
              {uploadLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-green-500/50 select-none">{">"}</span>
                  <span className={log.includes("Selesai!") ? "text-green-400 font-bold" : log.includes("Gagal") || log.includes("kesalahan") ? "text-red-400" : "text-gray-300"}>
                    {log}
                  </span>
                </div>
              ))}
              {/* Auto scroll anchor */}
              <div id="log-end" />
            </div>

            {/* Footer Action */}
            {isUploadSuccess || uploadProgress === 0 ? (
              <div className="border-t border-white/5 p-4 flex justify-end bg-[#111]">
                <button
                  onClick={() => {
                    setShowProgressModal(false);
                    if (isUploadSuccess) fetchDocs();
                  }}
                  className="rounded-lg bg-white/10 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  Tutup
                </button>
              </div>
            ) : (
              <div className="border-t border-white/5 p-4 flex justify-center bg-[#111]">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Harap jangan menutup jendela ini selama proses berlangsung
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4 shadow-lg backdrop-blur-sm">
        <div className="text-sm text-gray-300 w-full sm:w-auto text-center sm:text-left">
          Total Dokumen Aktif: <span className="font-bold text-white">{docs.length}</span>
        </div>
        
        <button
          onClick={() => handleUploadClick()}
          disabled={isUploading}
          className={`flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#e07a00] disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isUploading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Upload className="h-5 w-5" />
          )}
          {isUploading ? "Memproses AI..." : "Unggah File Baru .DOCX"}
        </button>
      </div>

      {/* Tabel Dokumen */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-sm">
        <div className="overflow-x-auto w-full rounded-lg ring-1 ring-white/10 shadow-2xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1a1a] text-xs uppercase text-brand">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold w-16 text-center whitespace-nowrap">No.</th>
                <th scope="col" className="px-6 py-4 font-semibold min-w-62.5">Nama Dokumen</th>
                <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">Nama File Asli</th>
                <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">Terakhir Diperbarui</th>
                <th scope="col" className="px-6 py-4 font-semibold w-32 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoadingData ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-brand" />
                      <p>Menarik data dari memori AI...</p>
                    </div>
                  </td>
                </tr>
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Belum ada dokumen yang diunggah. AI belum memiliki pengetahuan kualitatif.
                  </td>
                </tr>
              ) : (
                docs.slice((currentPage - 1) * 20, currentPage * 20).map((doc, index) => (
                  <tr 
                    key={doc.id} 
                    className="transition-colors hover:bg-white/5 group"
                  >
                    <td className="px-6 py-4 font-medium text-gray-500 text-center whitespace-nowrap">
                      {(currentPage - 1) * 20 + index + 1}
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        <div className="rounded bg-blue-500/20 p-2 text-blue-400 shrink-0">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="leading-snug">{doc.nama_dokumen}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                      <div 
                        onClick={() => handleDownload(doc.id, doc.nama_file_asli || doc.file_url)}
                        className="truncate max-w-30 sm:max-w-45 md:max-w-62.5 cursor-pointer hover:text-brand hover:underline transition-colors" 
                        title={`Klik untuk mengunduh: ${doc.nama_file_asli || doc.file_url}`}
                      >
                        {doc.nama_file_asli || doc.file_url}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-white/10">
                        {formatDate(doc.updated_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleUploadClick(doc.id)}
                          disabled={isUploading}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400 transition-colors disabled:opacity-50"
                          title="Update Dokumen (Replace File)"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setDocToDelete({ id: doc.id, nama: doc.nama_dokumen });
                            setShowDeleteConfirm(true);
                          }}
                          disabled={isUploading}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Hapus Dokumen Secara Permanen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {docs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border border-white/10 bg-white/5 rounded-xl shadow-lg mt-4 gap-4 backdrop-blur-sm">
          <div className="text-sm text-gray-400">
            Menampilkan halaman <span className="font-semibold text-white">{currentPage}</span> dari <span className="font-semibold text-white">{Math.ceil(docs.length / 20)}</span> <span className="hidden sm:inline">&mdash; Total: {docs.length} Dokumen</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all ring-1 ring-white/10"
            >
              &larr; Prev
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(docs.length / 20)))}
              disabled={currentPage === Math.ceil(docs.length / 20) || docs.length === 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all ring-1 ring-white/10"
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
