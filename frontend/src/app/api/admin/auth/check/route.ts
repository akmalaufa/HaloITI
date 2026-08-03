import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    // Jika tidak ada session atau email, otomatis bukan admin
    if (!session || !session.user?.email) {
      return NextResponse.json({ isAdmin: false });
    }
    
    const userEmail = session.user.email;
    
    // 1. Cek Jalur God Mode (Super Admin dari .env)
    if (userEmail === process.env.SUPER_ADMIN_EMAIL) {
      return NextResponse.json({ isAdmin: true });
    }
    
    // 2. Cek Jalur Database (Admin Operasional di Backend Python)
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const apiKey = process.env.NEXT_PUBLIC_X_API_KEY || process.env.X_API_KEY;
    
    const res = await fetch(`${backendUrl}/api/admin/admin-users`, {
      headers: {
        "X-API-Key": apiKey as string
      },
      cache: 'no-store' // Jangan di-cache agar selalu real-time
    });
    
    if (!res.ok) {
      console.error("Backend check-admin error response:", await res.text());
      return NextResponse.json({ isAdmin: false });
    }
    
    const data = await res.json();
    
    // Periksa apakah userEmail ada di dalam daftar admin dari database
    const isAdmin = Array.isArray(data) && data.some((admin: any) => admin.email === userEmail);
      
    if (isAdmin) {
      return NextResponse.json({ isAdmin: true });
    }
    
    return NextResponse.json({ isAdmin: false });
  } catch (error) {
    console.error("Server error check-admin:", error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
