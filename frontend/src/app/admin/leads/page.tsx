export const metadata = {
  title: "Buku Tamu (Leads) | Admin Panel - HaloITI",
};

import { Users } from "lucide-react";
import LeadsTableClient from "@/components/admin/LeadsTableClient";

async function getLeads() {
  try {
    const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${backendUrl}/api/admin/leads`, {
      cache: 'no-store',
      headers: {
        'X-API-Key': process.env.X_API_KEY || ''
      }
    });

    if (!res.ok) {
      throw new Error('Gagal menarik data dari server');
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("Error getLeads:", error);
    return [];
  }
}

export default async function LeadsPage() {
  const leads = await getLeads();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 items-center text-center sm:items-start sm:text-left">
        <h1 className="flex items-center justify-center sm:justify-start gap-2 text-3xl font-bold tracking-tight text-white">
          <Users className="h-8 w-8 text-brand" />
          Buku Tamu Pendaftar
        </h1>
        <p className="text-gray-400 max-w-xl">
          Daftar seluruh calon mahasiswa baru (Leads) yang telah berinteraksi dengan AI dan menginputkan datanya.
        </p>
      </div>

      {/* Tabel Real-Time (Client Component) */}
      <LeadsTableClient initialLeads={leads} />
    </div>
  );
}
