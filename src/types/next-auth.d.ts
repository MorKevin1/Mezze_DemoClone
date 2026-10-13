// Extend NextAuth types to include custom fields
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      restaurantId: string;
      restaurantName: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    restaurantId?: string;
    restaurantName?: string;
    role?: string;
  }
}
