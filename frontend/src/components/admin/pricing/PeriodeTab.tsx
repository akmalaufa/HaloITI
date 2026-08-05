"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Link as LinkIcon } from "lucide-react";

export type Periode = {
  id_periode: number;
  sistem: string;
  nama_jalur: string;
  gelombang: number;
  tgl_buka: string;
  tgl_tutup: string;
  link_pendaftaran?: string;
};

export default function PeriodeTab() {
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Toast State
  const [toast, setToast] = useState<{show: boolean, type: "success" | "error", message: string}>({show: false, type: "success", message: ""});

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };
  
  // Form State
  const [formData, setFormData] = useState<Periode>({
    id_periode: 0,
    sistem: "Reguler",
    nama_jalur: "",
    gelombang: 1,
    tgl_buka: new Date().toISOString().split("T")[0],
    tgl_tutup: new Date().toISOString().split("T")[0],
    link_pendaftaran: "",
  });

  // Filter State
  const [filterSistem, setFilterSistem] = useState<string>("ALL");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Delete State
  const [periodeToDelete, setPeriodeToDelete] = useState<Periode | null>(null);

  const fetchPeriode = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/admin/periode`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" },
      });
      if (res.ok) {
        const json = await res.json();
        setPeriodeList(Array.isArray(json) ? json : []);
      }
    } catch (error) {
      console.error("Error fetching periode:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriode();
  }, []);

  const openAddModal = () => {
    setErrorMessage(null);
    setIsEditMode(false);
    setFormData({
      id_periode: 0,
      sistem: "Reguler",
      nama_jalur: "",
      gelombang: 1,
      tgl_buka: new Date().toISOString().split("T")[0],
      tgl_tutup: new Date().toISOString().split("T")[0],
      link_pendaftaran: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (periode: Periode) => {
    setErrorMessage(null);
    setIsEditMode(true);
    // Format date string to YYYY-MM-DD for input type="date"
    const formatDateForInput = (dateStr: string) => {
      try {
        return new Date(dateStr).toISOString().split("T")[0];
      } catch {
        return dateStr;
      }
    };
    
    setFormData({
      ...periode,
      tgl_buka: formatDateForInput(periode.tgl_buka),
      tgl_tutup: formatDateForInput(periode.tgl_tutup),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = isEditMode 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/admin/periode/${formData.id_periode}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/admin/periode`;
      
      const method = isEditMode ? "PUT" : "POST";
      
      // We don't send id_periode on POST because it's auto-increment
      const { id_periode, ...payload } = formData;
      
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "",
        },
        body: JSON.stringify(isEditMode ? payload : payload)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchPeriode();
        showToast("success", isEditMode ? "Berhasil mengupdate data Periode!" : "Berhasil menambahkan data Periode!");
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.detail || "Gagal menyimpan data Periode";
        setErrorMessage(errMsg);
        showToast("error", `Gagal! Alasan: ${errMsg}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan jaringan");
      showToast("error", "Gagal! Terjadi kesalahan jaringan server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!periodeToDelete) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/admin/periode/${periodeToDelete.id_periode}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" },
      });
      if (res.ok) {
        setPeriodeToDelete(null);
        fetchPeriode();
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMessage(errData?.detail || "Gagal menghapus Periode");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to determine if a period is active
  const isPeriodActive = (tgl_buka: string, tgl_tutup: string) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const start = new Date(tgl_buka);
    start.setHours(0,0,0,0);
    const end = new Date(tgl_tutup);
    end.setHours(23,59,59,999);
    
    return today >= start && today <= end;
  };

  // Derived state for Filtering
  const filteredPeriodeList = periodeList.filter(periode => {
    if (filterSistem !== "ALL") {
      return periode.sistem === filterSistem;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredPeriodeList.length / itemsPerPage);
  const currentPeriodeList = filteredPeriodeList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-4 w-full relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 md:translate-x-0 md:right-6 z-9999 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all transform duration-300 animate-in fade-in slide-in-from-top-4 ${toast.type === "success" ? "bg-emerald-500/90 border border-emerald-400" : "bg-red-500/90 border border-red-400"} text-white backdrop-blur-md`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-white">Daftar Periode Pendaftaran</h2>
          <div className="flex flex-wrap gap-2">
            {["ALL", "Reguler", "RPL", "PSPPI"].map((sys) => (
              <button
                key={sys}
                onClick={() => { setFilterSistem(sys); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterSistem === sys 
                    ? "bg-brand text-white shadow-md shadow-brand/20 border border-brand" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {sys === "ALL" ? "Semua Program" : sys === "Reguler" ? "S1 Reguler" : sys === "RPL" ? "S1 RPL (Rekognisi)" : "PSPPI"}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e07a00] shrink-0"
        >
          <Plus className="h-4 w-4" />
          Tambah Periode
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-sm">
        <div className="overflow-x-auto w-full rounded-lg ring-1 ring-white/10">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1a1a] text-xs uppercase text-brand">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold w-16 text-center">No.</th>
                <th scope="col" className="px-6 py-4 font-semibold">Sistem</th>
                <th scope="col" className="px-6 py-4 font-semibold">Jalur & Gelombang</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center">Tanggal Buka - Tutup</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center">Status</th>
                <th scope="col" className="px-6 py-4 font-semibold w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin text-brand mx-auto mb-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : currentPeriodeList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data Periode Pendaftaran.
                  </td>
                </tr>
              ) : (
                currentPeriodeList.map((periode, index) => (
                  <tr key={periode.id_periode} className="transition-colors hover:bg-white/5 group">
                    <td className="px-6 py-4 font-medium text-gray-500 text-center">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className="px-6 py-4 text-white">
                      <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                        {periode.sistem}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-2">
                        <span>{periode.nama_jalur} <span className="text-gray-400">(Gelombang {periode.gelombang})</span></span>
                        {periode.link_pendaftaran && (
                          <a href={periode.link_pendaftaran} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors" title="Buka Link Pendaftaran">
                            <LinkIcon className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-xs text-gray-400">
                      {periode.tgl_buka} <span className="mx-2">s/d</span> {periode.tgl_tutup}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isPeriodActive(periode.tgl_buka, periode.tgl_tutup) ? (
                        <span className="inline-flex items-center rounded-md bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400 ring-1 ring-inset ring-green-500/20">
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/20">
                          Tutup
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEditModal(periode)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                          title="Edit Periode"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setErrorMessage(null);
                            setPeriodeToDelete(periode);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Hapus Periode"
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

      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg backdrop-blur-sm mt-2">
          <p className="text-sm text-gray-400">
            Halaman <span className="text-white font-medium">{currentPage}</span> dari <span className="text-white font-medium">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-gray-300 disabled:opacity-50 border border-white/10 hover:bg-white/5 transition-all text-sm font-medium"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 rounded-lg bg-[#1a1a1a] text-gray-300 disabled:opacity-50 border border-white/10 hover:bg-white/5 transition-all text-sm font-medium"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">
                {isEditMode ? "Edit Periode" : "Tambah Periode"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Sistem</label>
                  <select
                    required
                    className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                    value={formData.sistem}
                    onChange={(e) => setFormData({...formData, sistem: e.target.value})}
                  >
                    <option value="Reguler">Reguler</option>
                    <option value="RPL">RPL</option>
                    <option value="PSPPI">PSPPI</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Gelombang</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                    placeholder="Contoh: 1"
                    value={formData.gelombang || ""}
                    onChange={(e) => setFormData({...formData, gelombang: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Nama Jalur</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                  placeholder="Contoh: Jalur Undangan (Prestasi)"
                  value={formData.nama_jalur}
                  onChange={(e) => setFormData({...formData, nama_jalur: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Tanggal Buka</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                    value={formData.tgl_buka}
                    onChange={(e) => setFormData({...formData, tgl_buka: e.target.value})}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-300">Tanggal Tutup</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                    value={formData.tgl_tutup}
                    onChange={(e) => setFormData({...formData, tgl_tutup: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Link Pendaftaran (Opsional)</label>
                <input
                  type="url"
                  className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                  placeholder="Contoh: https://pmb.iti.ac.id/reguler"
                  value={formData.link_pendaftaran || ""}
                  onChange={(e) => setFormData({...formData, link_pendaftaran: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand font-medium text-white hover:bg-[#e07a00] transition-all disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Simpan Periode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {periodeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#121212] p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Hapus Periode?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus periode <strong>{periodeToDelete.nama_jalur} ({periodeToDelete.gelombang})</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-2 text-left">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Ya, Hapus Permanen
              </button>
              <button
                onClick={() => setPeriodeToDelete(null)}
                disabled={isSubmitting}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-400 transition-all hover:bg-white/5 hover:text-white"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
