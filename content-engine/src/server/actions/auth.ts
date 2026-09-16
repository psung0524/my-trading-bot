"use server";

import { headers } from "next/headers";
import { AuthError as NextAuthError } from "next-auth";
import { prisma } from "@/server/db/prisma";
import { hashPassword } from "@/server/auth/password";
import { signIn, signOut } from "@/server/auth/auth";
import { signupSchema, loginSchema } from "@/lib/schemas/auth";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { rateLimiter, clientIp } from "@/server/security/rate-limit";
import { audit } from "@/server/security/audit";
import { zodFieldErrors } from "@/lib/zod-errors";

export async function signupAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  }
  const ip = clientIp(await headers());
  const rl = await rateLimiter.check(`signup:${ip}`, 10, 10 * 60 * 1000);
  if (!rl.ok) return fail("요청이 너무 많습니다. 잠시 후 다시 시도하세요");

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("이미 가입된 이메일입니다", { email: ["이미 가입된 이메일입니다"] });

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });
  await audit({ userId: user.id, action: "user.signup", entityType: "User", entityId: user.id, ip });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (e) {
    if (!(e instanceof NextAuthError)) throw e;
    return fail("가입은 완료됐지만 자동 로그인에 실패했습니다. 로그인해 주세요");
  }
  return ok({ userId: user.id });
}

export async function loginAction(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail("입력값을 확인하세요", zodFieldErrors(parsed.error));
  const ip = clientIp(await headers());
  const rl = await rateLimiter.check(`login:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return fail("로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요");

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (e) {
    if (e instanceof NextAuthError) return fail("이메일 또는 비밀번호가 올바르지 않습니다");
    throw e;
  }
  return ok(undefined);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
