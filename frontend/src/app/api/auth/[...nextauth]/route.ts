import { NextRequest } from "next/server";
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    maxAge: 7 * 24 * 60 * 60, // Sesi berlaku 1 Minggu (dalam detik)
  },
  callbacks: {
    async session({ session }) {
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const nextAuthHandler = NextAuth(authOptions);

const handler = async (req: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) => {
  // Await the params Promise required by Next.js 15+ App Router
  const params = await context.params;
  return nextAuthHandler(req, { params });
};

export { handler as GET, handler as POST };
