// NextAuth API route handler
// This handles all /api/auth/* requests (login, logout, session, etc.)

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
