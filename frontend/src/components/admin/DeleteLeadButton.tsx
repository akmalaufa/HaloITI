"use client";

import { Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

export default function DeleteLeadButton({ idLead, nama }: { idLead: string, nama: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/leads/${idLead}`, {
        method: "DELETE",
        headers: {
          "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || ""
        },
      });

      if (!res.ok) {
        throw new Error("Gagal menghapus data");
      }

      setShowModal(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menghapus data.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Hapus Permanen"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-500"
      >
        <Trash2 className="h-5 w-5" />
      </button>

      {/* Modal Konfirmasi Kustom via React Portal */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-[#18181b] p-6 text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="mb-2 text-xl font-bold text-white">Hapus Permanen?</h3>
            <p className="mb-6 text-sm text-gray-400">
              Yakin mau menghapus data maba <span className="font-semibold text-white">"{nama}"</span> beserta seluruh riwayat chat-nya? Tindakan ini tidak bisa dibatalkan.
            </p>
            
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  "Ya, Hapus"
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
