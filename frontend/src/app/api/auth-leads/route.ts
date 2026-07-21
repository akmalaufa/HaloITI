import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function POST(req: Request) {
  try {
    // 1. Interogasi Pos Satpam: Pastikan Maba punya Sesi Google Asli
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json(
        { error: "Akses Ditolak: Anda belum login dengan Google." },
        { status: 401 }
      );
    }

    // 2. Baca nomor WA yang dikirim dari Browser Maba
    let no_whatsapp = null;
    try {
      const body = await req.json();
      no_whatsapp = body.no_whatsapp;
    } catch (e) {
      // Body kosong artinya ini adalah Silent Check
    }

    // 3. Susun data murni dari Google untuk dikirim ke FastAPI
    const payload = {
      nama_lengkap: session.user.name || "Maba ITI",
      email_google: session.user.email,
      no_whatsapp: no_whatsapp,
    };

    // 4. Telepon Merah: Kirim request ke FastAPI dengan X-API-KEY
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    // Hati-hati, gunakan env internal untuk X-API-KEY agar aman
    const xApiKey = process.env.X_API_KEY || "SuperSecretITI2026";

    const response = await fetch(`${backendUrl}/api/leads/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": xApiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    // 5. Kembalikan jawaban dari FastAPI ke Browser Maba
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error("Proxy Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada Pos Satpam." },
      { status: 500 }
    );
  }
}
