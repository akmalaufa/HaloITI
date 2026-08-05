export const metadata = {
  title: "Manajemen Biaya Studi & Prodi | Admin Panel - HaloITI",
};

import { Calculator } from "lucide-react";
import PricingClient from "@/components/admin/PricingClient";

export default function PricingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 items-center text-center sm:items-start sm:text-left">
        <h1 className="flex items-center justify-center sm:justify-start gap-2 text-3xl font-bold tracking-tight text-white">
          <Calculator className="h-8 w-8 text-brand" />
          Manajemen Kuantitatif
        </h1>
        <p className="text-gray-400 max-w-2xl">
          Kelola data kuantitatif seperti Program Studi, Periode Pendaftaran, dan Harga UKT. Perubahan pada halaman ini akan langsung disinkronisasi ke memori AI secara otomatis.
        </p>
      </div>

      <PricingClient />
    </div>
  );
}
