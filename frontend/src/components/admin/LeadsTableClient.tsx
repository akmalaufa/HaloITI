"use client";

import React, { useState, useEffect } from "react";
import DeleteLeadButton from "./DeleteLeadButton";

type Lead = {
  id_lead: string;
  nama_lengkap: string;
  email_google: string;
  no_whatsapp: string;
  created_at: string;
};

export default function LeadsTableClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Polling Real-Time untuk daftar Maba di tabel
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const offset = (currentPage - 1) * 20;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/leads?limit=20&offset=${offset}`, {
          headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" }
        });
        if (res.ok) {
          const json = await res.json();
          setLeads(json.data || []);
          setTotalCount(json.total_count || 0);
        }
      } catch (error) {
        // Abaikan error polling
      }
    };
    
    // Tarik data langsung saat state currentPage berubah
    fetchLeads();

    // Tarik data ulang secara real-time setiap 5 detik
    const intervalId = setInterval(fetchLeads, 5000);
    return () => clearInterval(intervalId);
  }, [currentPage]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-1 shadow-lg backdrop-blur-sm">
      <div className="overflow-x-auto w-full rounded-lg ring-1 ring-white/10 shadow-2xl">
        <table className="w-full text-center text-sm text-gray-300">
          <thead className="bg-[#1a1a1a] text-xs uppercase text-brand">
            <tr>
              <th scope="col" className="px-6 py-4 font-semibold w-16 whitespace-nowrap">No.</th>
              <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">Nama Lengkap</th>
              <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">Email</th>
              <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">No. WhatsApp</th>
              <th scope="col" className="px-6 py-4 font-semibold whitespace-nowrap">Waktu Mendaftar</th>
              <th scope="col" className="px-6 py-4 font-semibold w-16 whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Belum ada pendaftar (leads) yang masuk.
                </td>
              </tr>
            ) : (
              leads.map((lead: any, index: number) => (
                <tr 
                  key={lead.id_lead} 
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="px-6 py-4 font-medium text-gray-500 whitespace-nowrap">
                    {(currentPage - 1) * 20 + index + 1}
                  </td>
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                    {lead.nama_lengkap}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{lead.email_google}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{lead.no_whatsapp}</td>
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-1 text-xs font-medium ring-1 ring-inset ring-white/10">
                      {lead.created_at}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <DeleteLeadButton idLead={lead.id_lead} nama={lead.nama_lengkap} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-white/10 gap-4">
          <div className="text-sm text-gray-400">
            Menampilkan halaman <span className="font-semibold text-white">{currentPage}</span> dari <span className="font-semibold text-white">{Math.ceil(totalCount / 20)}</span> <span className="hidden sm:inline">&mdash; Total: {totalCount} Pendaftar</span>
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
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalCount / 20)))}
              disabled={currentPage === Math.ceil(totalCount / 20) || totalCount === 0}
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
