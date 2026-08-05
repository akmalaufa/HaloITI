export const metadata = {
  title: "Manajemen Dokumen | Admin Panel - HaloITI",
};

import { FileText } from "lucide-react";
import KnowledgeTableClient from "@/components/admin/KnowledgeTableClient";

export default function KnowledgePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 items-center text-center sm:items-start sm:text-left">
        <h1 className="flex items-center justify-center sm:justify-start gap-2 text-3xl font-bold tracking-tight text-white">
          <FileText className="h-8 w-8 text-brand" />
          Manajemen Dokumen
        </h1>
        <p className="text-gray-400 max-w-2xl">
          Kelola basis pengetahuan (Knowledge Base) untuk AI. Unggah dokumen format Word (.docx) berisi pedoman, informasi beasiswa, UKT, dan profil kampus agar AI semakin cerdas menjawab pertanyaan.
        </p>
      </div>

      {/* Tabel Dokumen dan Form Upload (Client Component) */}
      <KnowledgeTableClient />
    </div>
  );
}
