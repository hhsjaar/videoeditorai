import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // The Prisma adapter's `user` is the full DB row at runtime even
        // though AdapterUser's type only declares the standard fields.
        session.user.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return session;
    },
  },
});
