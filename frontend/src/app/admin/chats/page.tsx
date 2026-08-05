import { MessageSquare } from "lucide-react";
import ChatViewer from "@/components/admin/ChatViewer";

export const metadata = {
  title: "History Chat | Admin Panel - HaloITI",
};

async function getLeads() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/admin/leads`, {
      cache: 'no-store',
      headers: {
        'X-API-Key': process.env.X_API_KEY || ''
      }
    });
    if (!res.ok) throw new Error('Gagal menarik data leads');
    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function ChatsPage() {
  const leads = await getLeads();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <MessageSquare className="h-6 w-6 text-brand" />
          History Chat
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Pantau riwayat percakapan antara Calon Mahasiswa
        </p>
      </div>

      {/* Main Content (Client Component) */}
      <ChatViewer initialLeads={leads} />
    </div>
  );
}
