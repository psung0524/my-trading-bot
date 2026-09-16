import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db/prisma";
import { verifyPassword } from "@/server/auth/password";
import { loginSchema } from "@/lib/schemas/auth";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "이메일",
    credentials: {
      email: { label: "이메일", type: "email" },
      password: { label: "비밀번호", type: "password" },
    },
    async authorize(raw) {
      const parsed = loginSchema.safeParse(raw);
      if (!parsed.success) return null;
      const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (!user || !user.passwordHash || user.deletedAt) return null;
      const ok = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.name, image: user.image };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }));
}
if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET }));
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/** 로그인 사용자 필수. 없으면 null 대신 예외를 던지지 않고 null 반환. */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, email: session.user.email ?? "", name: session.user.name ?? "" };
}
