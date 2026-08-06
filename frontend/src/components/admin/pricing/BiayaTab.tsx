"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Plus, Edit2, Trash2, X, AlertTriangle, Info, CheckCircle2 } from "lucide-react";
import type { Prodi } from "./ProdiTab";
import type { Periode } from "./PeriodeTab";

export type BiayaStudi = {
  id_biaya: number;
  id_prodi: number;
  id_periode: number;
  kelas: string;
  jenis_jalur: string;
  sks_min: number;
  sks_max: number;
  biaya_formulir: number;
  biaya_asesmen: number;
  biaya_pkkmb: number;
  upp_nominal: number;
  ukt_nominal: number;
  diskon_full_payment: number;
  diskon_alumni: number;
  diskon_pengurus_pii: number;
  diskon_gelombang: number;
  biaya_sertifikasi_pratama: number;
  biaya_sertifikasi_madya: number;
  biaya_sertifikasi_utama: number;
  // field tambahan hasil JOIN dari backend
  nama_prodi?: string;
  nama_jalur?: string;
  gelombang?: number;
};

const formatRupiah = (angka: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(angka);
};

export default function BiayaTab() {
  const [biayaList, setBiayaList] = useState<BiayaStudi[]>([]);
  const [prodiList, setProdiList] = useState<Prodi[]>([]);
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

  // Filter & Pagination States
  const [filterSistem, setFilterSistem] = useState<string>("ALL");
  const [filterProdi, setFilterProdi] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;
  
  // Form State
  const [formData, setFormData] = useState<BiayaStudi>({
    id_biaya: 0,
    id_prodi: 0,
    id_periode: 0,
    kelas: "Weekdays",
    jenis_jalur: "",
    sks_min: 0,
    sks_max: 0,
    biaya_formulir: 0,
    biaya_asesmen: 0,
    biaya_pkkmb: 0,
    upp_nominal: 0,
    ukt_nominal: 0,
    diskon_full_payment: 0,
    diskon_alumni: 0,
    diskon_pengurus_pii: 0,
    diskon_gelombang: 0,
    biaya_sertifikasi_pratama: 0,
    biaya_sertifikasi_madya: 0,
    biaya_sertifikasi_utama: 0,
  });

  // Delete State
  const [biayaToDelete, setBiayaToDelete] = useState<BiayaStudi | null>(null);

  const fetchSemuaData = async () => {
    setIsLoading(true);
    try {
      const headers = { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" };
      
      const [resBiaya, resProdi, resPeriode] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/biaya`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/prodi`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/periode`, { headers }),
      ]);
      
      if (resBiaya.ok) {
        const json = await resBiaya.json();
        setBiayaList(Array.isArray(json) ? json : []);
      }
      if (resProdi.ok) {
        const json = await resProdi.json();
        setProdiList(Array.isArray(json) ? json : []);
      }
      if (resPeriode.ok) {
        const json = await resPeriode.json();
        setPeriodeList(Array.isArray(json) ? json : []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSemuaData();
  }, []);

  const openAddModal = () => {
    setErrorMessage(null);
    setIsEditMode(false);
    setFormData({
      id_biaya: 0,
      id_prodi: prodiList.length > 0 ? prodiList[0].id_prodi : 0,
      id_periode: periodeList.length > 0 ? periodeList[0].id_periode : 0,
      kelas: "Weekdays",
      jenis_jalur: "Reguler",
      sks_min: 0,
      sks_max: 0,
      biaya_formulir: 0,
      biaya_asesmen: 0,
      biaya_pkkmb: 0,
      upp_nominal: 0,
      ukt_nominal: 0,
      diskon_full_payment: 0,
      diskon_alumni: 0,
      diskon_pengurus_pii: 0,
      diskon_gelombang: 0,
      biaya_sertifikasi_pratama: 0,
      biaya_sertifikasi_madya: 0,
      biaya_sertifikasi_utama: 0,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (biaya: BiayaStudi) => {
    setErrorMessage(null);
    setIsEditMode(true);
    setFormData(biaya);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    // Basic validation
    if (formData.id_prodi === 0 || formData.id_periode === 0) {
      setErrorMessage("Harap pilih Prodi dan Periode terlebih dahulu!");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const url = isEditMode 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/biaya/${formData.id_biaya}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/biaya`;
      
      const method = isEditMode ? "PUT" : "POST";
      
      // Remove id_biaya and joined fields for payload
      const { id_biaya, nama_prodi, nama_jalur, gelombang, ...payload } = formData;
      
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
        fetchSemuaData();
        showToast("success", isEditMode ? "Berhasil mengupdate data Biaya Studi!" : "Berhasil menambahkan data Biaya Studi!");
      } else {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.detail || "Gagal menyimpan data Biaya Studi";
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
    if (!biayaToDelete) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/biaya/${biayaToDelete.id_biaya}`, {
        method: "DELETE",
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" },
      });
      if (res.ok) {
        setBiayaToDelete(null);
        fetchSemuaData();
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMessage(errData?.detail || "Gagal menghapus Biaya Studi");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for numeric input changes
  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof BiayaStudi) => {
    const val = parseFloat(e.target.value);
    setFormData({ ...formData, [fieldName]: isNaN(val) ? 0 : val });
  };

  // Derived states for Filter & Pagination
  const filteredBiayaList = biayaList.filter(biaya => {
    let matchSistem = true;
    if (filterSistem !== "ALL") {
      const periode = periodeList.find(p => p.id_periode === biaya.id_periode);
      if (!periode) matchSistem = false;
      else matchSistem = periode.sistem === filterSistem;
    }
    
    let matchProdi = true;
    if (filterProdi !== "ALL") {
      matchProdi = biaya.id_prodi.toString() === filterProdi;
    }
    
    return matchSistem && matchProdi;
  });

  const totalPages = Math.ceil(filteredBiayaList.length / itemsPerPage);
  const currentBiayaList = filteredBiayaList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
          <h2 className="text-xl font-semibold text-white">Manajemen Biaya Studi & UKT</h2>
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
        <div className="flex gap-4 items-center">
          <select 
            className="bg-[#1a1a1a] border border-white/10 text-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            value={filterProdi}
            onChange={(e) => {
              setFilterProdi(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">Semua Program Studi</option>
            {prodiList.map(p => (
              <option key={p.id_prodi} value={p.id_prodi.toString()}>{p.nama_prodi}</option>
            ))}
          </select>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#e07a00]"
          >
            <Plus className="h-4 w-4" />
            Atur Biaya Baru
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-sm relative">
        <div className="overflow-x-auto w-full rounded-lg ring-1 ring-white/10">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#1a1a1a] text-xs uppercase text-brand">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] bg-[#1a1a1a]">Program Studi & Jalur</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center border-l border-white/5 bg-[#121212]">Biaya Pra-Kuliah</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center border-l border-white/5 bg-[#1a1a1a]">Biaya Pokok</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center border-l border-white/5 bg-[#121212]">Diskon & Potongan</th>
                <th scope="col" className="px-6 py-4 font-semibold text-center w-32 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)] border-l border-white/10 bg-[#1a1a1a]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 relative z-0">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin text-brand mx-auto mb-2" />
                    Menarik data engine harga...
                  </td>
                </tr>
              ) : filteredBiayaList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Belum ada data Biaya Studi yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                currentBiayaList.map((biaya) => (
                  <tr key={biaya.id_biaya} className="transition-colors hover:bg-white/5 group">
                    <td className="bg-[#151515] group-hover:bg-[#1a1a1a] px-6 py-4 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)] transition-colors align-top">
                      <div className="font-semibold text-white">{biaya.nama_prodi}</div>
                      <div className="text-xs text-gray-400 mt-1 flex flex-col gap-0.5">
                        <span className="text-blue-400">{biaya.nama_jalur} (Gelombang {biaya.gelombang})</span>
                        <span>Kelas {biaya.kelas} &bull; {biaya.jenis_jalur || "Reguler"}</span>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 border-l border-white/5 bg-[#121212]/50 align-top">
                      <div className="flex flex-col gap-1.5 text-sm w-48 mx-auto">
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">Formulir:</span> <span className="text-gray-200 font-medium">{formatRupiah(biaya.biaya_formulir)}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">Asesmen:</span> <span className="text-gray-200 font-medium">{formatRupiah(biaya.biaya_asesmen)}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">PKKMB:</span> <span className="text-gray-200 font-medium">{formatRupiah(biaya.biaya_pkkmb)}</span></div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 border-l border-white/5 bg-[#151515]/50 align-top">
                      <div className="flex flex-col gap-1.5 text-sm w-56 mx-auto">
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">UPP (Pangkal):</span> <span className="text-brand font-medium">{formatRupiah(biaya.upp_nominal)}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">UKT (Semester):</span> <span className="text-green-400 font-medium">{formatRupiah(biaya.ukt_nominal)}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">SKS (Min-Max):</span> <span className="text-gray-300">{biaya.sks_min > 0 || biaya.sks_max > 0 ? `${biaya.sks_min} - ${biaya.sks_max}` : "-"}</span></div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 border-l border-white/5 bg-[#121212]/50 align-top">
                      <div className="flex flex-col gap-1.5 text-sm w-48 mx-auto">
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">Full Pymt:</span> <span className="text-green-400">{biaya.diskon_full_payment > 0 ? `-${formatRupiah(biaya.diskon_full_payment)}` : "-"}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">Alumni:</span> <span className="text-blue-400">{biaya.diskon_alumni > 0 ? `-${formatRupiah(biaya.diskon_alumni)}` : "-"}</span></div>
                        <div className="flex justify-between items-center gap-2"><span className="text-gray-400">PII:</span> <span className="text-purple-400">{biaya.diskon_pengurus_pii > 0 ? `-${formatRupiah(biaya.diskon_pengurus_pii)}` : "-"}</span></div>
                      </div>
                    </td>
                    
                    <td className="bg-[#151515] group-hover:bg-[#1a1a1a] px-6 py-4 text-center shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.5)] border-l border-white/10 transition-colors align-top">
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <button 
                          onClick={() => openEditModal(biaya)}
                          className="rounded-lg p-2 text-gray-500 hover:bg-blue-500/20 hover:text-blue-400 transition-colors"
                          title="Edit Harga"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setErrorMessage(null);
                            setBiayaToDelete(biaya);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                          title="Hapus Harga"
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
        {totalPages > 1 && (
          <div className="flex justify-between items-center p-4 border-t border-white/10 bg-[#121212]/50 rounded-b-xl">
            <span className="text-sm text-gray-400">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredBiayaList.length)} dari {filteredBiayaList.length} data
            </span>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Sebelumnya
              </button>
              <button 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-sm text-gray-300 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FORM BIAYA STUDI */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* Hilangkan panah spinner bawaan input type="number" */
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Modal Add/Edit (Heavy Form) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#121212] shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-xl font-semibold text-white">
                {isEditMode ? "Edit Rincian Biaya Studi" : "Tambah Rincian Biaya Studi"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
              {errorMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}
              {/* SECTION 1: IDENTITAS */}
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <h4 className="text-brand font-semibold text-sm uppercase tracking-wider mb-2">1. Identitas Program Studi & Periode</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Program Studi</label>
                    <select
                      required
                      className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                      value={formData.id_prodi}
                      onChange={(e) => setFormData({...formData, id_prodi: parseInt(e.target.value)})}
                    >
                      <option value={0} disabled>-- Pilih Prodi --</option>
                      {prodiList.map(p => (
                        <option key={p.id_prodi} value={p.id_prodi}>{p.nama_prodi} ({p.jenjang})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Periode Pendaftaran</label>
                    <select
                      required
                      className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                      value={formData.id_periode}
                      onChange={(e) => setFormData({...formData, id_periode: parseInt(e.target.value)})}
                    >
                      <option value={0} disabled>-- Pilih Periode --</option>
                      {periodeList.map(p => (
                        <option key={p.id_periode} value={p.id_periode}>{p.nama_jalur} ({p.gelombang})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Kelas</label>
                    <select
                      required
                      className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                      value={formData.kelas}
                      onChange={(e) => setFormData({...formData, kelas: e.target.value})}
                    >
                      <option value="Weekdays">Weekdays</option>
                      <option value="Weekend">Weekend</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Jenis Jalur (Opsional)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand transition-all"
                      placeholder="Contoh: Prestasi, USM, dsb"
                      value={formData.jenis_jalur || ""}
                      onChange={(e) => setFormData({...formData, jenis_jalur: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: BIAYA DASAR */}
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <h4 className="text-brand font-semibold text-sm uppercase tracking-wider mb-2">2. Biaya Dasar & Pokok (Rp)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Biaya Formulir</label>
                    <input type="number" required className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_formulir || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_formulir")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Biaya PKKMB</label>
                    <input type="number" required className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_pkkmb || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_pkkmb")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Biaya Asesmen (Opsional)</label>
                    <input type="number" required className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_asesmen || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_asesmen")} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 p-4 bg-brand/10 rounded-lg border border-brand/20">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-brand">UPP (Uang Pangkal)</label>
                    <input type="number" required className="w-full rounded-lg bg-[#1a1a1a] border border-brand/30 px-4 py-3 text-white font-semibold text-lg" value={formData.upp_nominal || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "upp_nominal")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-brand">UKT (Per Semester)</label>
                    <input type="number" required className="w-full rounded-lg bg-[#1a1a1a] border border-brand/30 px-4 py-3 text-white font-semibold text-lg" value={formData.ukt_nominal || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "ukt_nominal")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Batas Minimum SKS (Opsional)</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.sks_min || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "sks_min")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Batas Maksimum SKS (Opsional)</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.sks_max || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "sks_max")} />
                  </div>
                </div>
              </div>

              {/* SECTION 3: DISKON */}
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                <h4 className="text-brand font-semibold text-sm uppercase tracking-wider mb-2">3. Diskon & Potongan (Rp)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Potongan Full Payment</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.diskon_full_payment || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "diskon_full_payment")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Potongan Alumni</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.diskon_alumni || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "diskon_alumni")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Potongan Pengurus PII</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.diskon_pengurus_pii || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "diskon_pengurus_pii")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-300">Potongan Gelombang Khusus</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.diskon_gelombang || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "diskon_gelombang")} />
                  </div>
                </div>
              </div>

              {/* SECTION 4: SERTIFIKASI PSPPI */}
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/5 opacity-80">
                <div className="flex gap-2 items-center text-brand mb-2">
                  <Info className="h-4 w-4" />
                  <h4 className="font-semibold text-sm uppercase tracking-wider">4. Khusus Program Profesi (PSPPI)</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Sertifikasi Pratama (IPP)</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_sertifikasi_pratama || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_sertifikasi_pratama")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Sertifikasi Madya (IPM)</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_sertifikasi_madya || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_sertifikasi_madya")} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Sertifikasi Utama (IPU)</label>
                    <input type="number" className="w-full rounded-lg bg-[#1a1a1a] border border-white/10 px-4 py-2 text-white" value={formData.biaya_sertifikasi_utama || ""} placeholder="0" onChange={(e) => handleNumericChange(e, "biaya_sertifikasi_utama")} />
                  </div>
                </div>
              </div>

            </form>

            <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-[#121212] rounded-b-2xl">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-lg font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-brand font-medium text-white hover:bg-[#e07a00] transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Simpan & Sinkronisasi ke AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete */}
      {biayaToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-500/20 bg-[#121212] p-6 shadow-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Hapus Skema Biaya?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Apakah Anda yakin ingin menghapus skema biaya untuk <strong>{biayaToDelete.nama_prodi}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                onClick={() => setBiayaToDelete(null)}
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
