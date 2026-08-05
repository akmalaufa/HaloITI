"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";

export type Prodi = {
  id_prodi: number;
  nama_prodi: string;
  jenjang: string;
};

export default function ProdiTab() {
  const [prodiList, setProdiList] = useState<Prodi[]>([]);
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
  const [formData, setFormData] = useState<Prodi>({
    id_prodi: 0,
    nama_prodi: "",
    jenjang: "S1"
  });

  // Delete State
  const [prodiToDelete, setProdiToDelete] = useState<Prodi | null>(null);

  const fetchProdi = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/admin/prodi", {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" },
      });
      if (res.ok) {
        const json = await res.json();
        setProdiList(Array.isArray(json) ? json : []);
      }
    } catch (error) {
      console.error("Error fetching prodi:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProdi();
  }, []);

  const openAddModal = () => {
    setErrorMessage(null);
    setIsEditMode(false);
    setFormData({ id_prodi: 0, nama_prodi: "", jenjang: "S1" });
    setIsModalOpen(true);
  };

  const openEditModal = (prodi: Prodi) => {
    setErrorMessage(null);
    setIsEditMode(true);
    setFormData(prodi);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = isEditMode 
        ? `http://127.0.0.1:8000/api/admin/prodi/${formData.id_prodi}`
        : `http://127.0.0.1:8000/api/admin/prodi`;
      
      const method = isEditMode ? "PUT" : "POST";
      
      const payload = isEditMode 
        ? { nama_prodi: formData.nama_prodi, jenjang: formData.jenjang } // Sesuai ProdiUpdate
        : formData; // Sesuai ProdiCreate (butuh id_prodi dll)
        
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "",
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setIsModalOpen(false);
        fetchProdi();
        showToast("success", isEditMode ? "Berhasil mengupdate data Prodi!" : "Berhasil menambahkan data Prodi!");
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.detail || "Gagal menyimpan data Prodi";
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
    if (!prodiToDelete) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/prodi/${prodiToDelete.id_prodi}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" },
      });
      if (res.ok) {
        setProdiToDelete(null);
        fetchProdi();
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMessage(errData?.detail || "Gagal menghapus Prodi");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-6 right-1/2 translate-x-1/2 md:translate-x-0 md:right-6 z-9999 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 transition-all transform duration-300 animate-in fade-in slide-in-from-top-4 ${toast.type === "success" ? "bg-emerald-500/90 border border-emerald-400" : "bg-red-500/90 border border-red-400"} text-white backdrop-blur-md`}>
          {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/10 shadow-lg backdrop-blur-sm">
        <h2 className="text-xl font-semibold text-white">Daftar Program Studi</h2>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e07a00]"
        >
          <Plus className="h-4 w-4" />
          Tambah Prodi
        </button>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-sm">
        <div className="overflow-x-auto w-full rounded-lg ring-1 ring-white/10">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1a1a] text-xs uppercase text-brand">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold w-16 text-center">No.</th>
                <th scope="col" className="px-6 py-4 font-semibold">Nama Program Studi</th>
                <th scope="col" className="px-6 py-4 font-semibold w-48 text-center">Jenjang</th>
                <th scope="col" className="px-6 py-4 font-semibold w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin text-brand mx-auto mb-2" />
                    Memuat data...
                  </td>
                </tr>
              ) : prodiList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data Program Studi.
                  </td>
                </tr>
              ) : (
                prodiList.map((prodi, index) => (
                  <tr key={prodi.id_prodi} className="transition-colors hover:bg-white/5 group">
                    <td className="px-6 py-4 font-medium text-gray-500 text-center">{index + 1}</td>
                    <td className="px-6 py-4 font-medium text-white">{prodi.nama_prodi}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-gray-300 font-medium">
                        {prodi.jenjang}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEditModal(prodi)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                          title="Edit Prodi"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setErrorMessage(null);
                            setProdiToDelete(prodi);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Hapus Prodi"
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

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">
                {isEditMode ? "Edit Program Studi" : "Tambah Program Studi"}
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
              {/* ID Prodi ditampilkan, dan sekarang bisa diedit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">
                  ID Prodi (Angka Unik)
                </label>
                <input
                  type="number"
                  required
                  className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-white placeholder-gray-500 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  value={formData.id_prodi || ""}
                  onChange={(e) => setFormData({...formData, id_prodi: parseInt(e.target.value) || 0})}
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Nama Program Studi</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                  placeholder="Contoh: Teknik Informatika"
                  value={formData.nama_prodi}
                  onChange={(e) => setFormData({...formData, nama_prodi: e.target.value})}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-300">Jenjang</label>
                <select
                  required
                  className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                  value={formData.jenjang}
                  onChange={(e) => setFormData({...formData, jenjang: e.target.value})}
                >
                  <option value="S1">S1</option>
                  <option value="Profesi Insinyur">Profesi Insinyur</option>
                </select>
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
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {prodiToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#121212] p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Hapus Program Studi?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus <strong>{prodiToDelete.nama_prodi}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                onClick={() => setProdiToDelete(null)}
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
