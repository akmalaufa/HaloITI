import AdminLayoutWrapper from "@/components/admin/AdminLayoutWrapper";

export const metadata = {
  title: "Admin Panel | HaloITI",
  description: "Sistem Kendali dan Observability AI Kampus ITI",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Efek Bintik Khas ITI (diwarisi dari globals.css) */}
      <div className="noise-overlay" />
      
      <AdminLayoutWrapper>
        {children}
      </AdminLayoutWrapper>
    </div>
  );
}
