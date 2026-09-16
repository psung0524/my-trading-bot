import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * 낙관적 인증 검사. 실제 권한은 서버 컴포넌트/액션에서 다시 검증한다.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = pathname.startsWith("/w/") || pathname.startsWith("/onboarding");
  if (!needsAuth) return NextResponse.next();

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.AUTH_URL?.startsWith("https://") ?? false,
  });
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/w/:path*", "/onboarding/:path*"],
};
