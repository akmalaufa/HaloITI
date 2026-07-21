import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Hanya rute yang diawali dengan /chat yang dijaga satpam
  matcher: ["/chat/:path*"], 
};
