"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, UserPlus, ShieldAlert } from "lucide-react";
import { useSession } from "next-auth/react";

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, email: string} | null>(null);
  
  const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "";

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/admin-users`, {
        headers: {
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY as string
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } catch (error) {
      console.error("Gagal mengambil data admin", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/admin-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY as string
        },
        body: JSON.stringify({ email: newEmail })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAlertMessage({ type: 'success', text: 'Berhasil menambahkan admin!' });
        setNewEmail("");
        fetchAdmins();
      } else {
        setAlertMessage({ type: 'error', text: data.detail || "Terjadi kesalahan." });
      }
    } catch (error) {
      setAlertMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setIsSubmitting(false);
      // Hilangkan pesan setelah 3 detik
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteConfirm) return;
    const { id, email } = deleteConfirm;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/admin-users/${id}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY as string
        }
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setAlertMessage({ type: 'success', text: 'Akses admin berhasil dicabut.' });
        
        // Pengecekan: Jika yang dihapus adalah diri sendiri, tendang ke landing page
        if (session?.user?.email === email) {
          setTimeout(() => {
            window.location.href = '/';
          }, 800); // Beri jeda 800ms agar alert sukses sempat terlihat
          return;
        }

        fetchAdmins();
      } else {
        setAlertMessage({ type: 'error', text: data.detail || "Terjadi kesalahan." });
      }
    } catch (error) {
      setAlertMessage({ type: 'error', text: 'Terjadi kesalahan jaringan.' });
    } finally {
      setDeleteConfirm(null);
      // Hilangkan pesan setelah 3 detik
      setTimeout(() => setAlertMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Custom Modal Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-red-500" />
              Cabut Akses Admin
            </h3>
            <p className="text-gray-300 mb-6">
              Apakah Anda yakin ingin mencabut akses admin dari <strong className="text-white">{deleteConfirm.email}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                className="border-white/10 text-gray-300 hover:text-white"
                onClick={() => setDeleteConfirm(null)}
              >
                Batal
              </Button>
              <Button 
                className="bg-red-500 hover:bg-red-600 text-white"
                onClick={handleDeleteAdmin}
              >
                Ya, Cabut Akses
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Alert Message */}
      {alertMessage && (
        <div className={`fixed top-24 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border animate-in slide-in-from-top-2 fade-in duration-300 ${
          alertMessage.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {alertMessage.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-brand" />
            Manajemen Akses Admin
          </h1>
          <p className="text-gray-400 mt-1">
            Kelola email staf yang memiliki akses penuh ke Dashboard Admin ini.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Form Tambah Admin */}
        <div className="md:col-span-1">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-6">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand" />
              Beri Akses Baru
            </h2>
            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">Alamat Email Google (Gmail/Workspace)</label>
                <input
                  type="email"
                  required
                  placeholder="staf@iti.ac.id"
                  className="w-full rounded-lg bg-black/50 border border-white/10 px-4 py-2 text-white focus:outline-none focus:border-brand"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-brand text-white hover:bg-brand/90"
              >
                {isSubmitting ? "Memproses..." : "Tambahkan Admin"}
              </Button>
            </form>
          </div>
        </div>

        {/* Tabel Daftar Admin */}
        <div className="md:col-span-2">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="bg-black/50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-medium">Alamat Email</th>
                    <th className="px-6 py-4 font-medium">Ditambahkan Pada</th>
                    <th className="px-6 py-4 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                        Memuat data...
                      </td>
                    </tr>
                  ) : admins.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                        Belum ada admin yang terdaftar di database.
                      </td>
                    </tr>
                  ) : (
                    admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">
                          {admin.email}
                        </td>
                        <td className="px-6 py-4">
                          {new Date(admin.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ id: admin.id, email: admin.email })}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Cabut Akses
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-black/20 p-4 border-t border-white/5 text-xs text-gray-500 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-yellow-500/70" />
              <p>
                Jika hanya tersisa 1 admin di dalam database, maka tombol Cabut Akses tidak akan berfungsi. 
                Sistem memastikan agar fitur Admin tidak pernah terkunci selamanya.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
