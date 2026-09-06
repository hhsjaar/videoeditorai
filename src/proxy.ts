import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Public paths that must stay reachable without a session: the login page,
// Auth.js's own routes, the Midtrans server-to-server webhook (no cookie),
// and Next's static/internal assets.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/payment/webhook"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Silakan login dulu." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
