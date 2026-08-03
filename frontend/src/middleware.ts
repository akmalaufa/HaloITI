import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  async function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAdminPage = req.nextUrl.pathname.startsWith("/admin");

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }
      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }

    // Pengecekan Khusus Halaman Admin
    if (isAdminPage) {
      const userEmail = token?.email;
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

      // 1. Cek Jalur God Mode (Super Admin dari .env)
      if (userEmail === superAdminEmail) {
        return NextResponse.next();
      }

      // 2. Cek Jalur Database (Admin Operasional di Backend Python)
      if (userEmail) {
        try {
          const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || process.env.X_API_KEY;
          
          const res = await fetch(`${backendUrl}/api/admin/admin-users`, {
            headers: {
              "X-API-Key": apiKey as string
            },
            // Jangan di-cache, pastikan validasi selalu real-time dari database
            cache: 'no-store'
          });
          
          const data = await res.json();
          
          // Jika email terdaftar di database, izinkan masuk
          const isAdmin = Array.isArray(data) && data.some((admin: any) => admin.email === userEmail);
          if (isAdmin) {
            return NextResponse.next();
          }
        } catch (error) {
          console.error("Gagal verifikasi admin ke Backend Python:", error);
        }
      }

      // 3. Jika gagal semua, berarti dia cuma user biasa, tendang balik ke halaman depan
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Izinkan akses middleware jika ada token
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  // Rute yang dijaga satpam
  matcher: ["/chat/:path*", "/admin/:path*"], 
};
