import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // OAuth コールバックは認証フローの途中なので素通しする
  if (pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  const { supabaseResponse, user, approved } = await updateSession(request);

  const isLoginPage = pathname === "/login";
  const isJoinPage = pathname === "/join";

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  // 1) 未ログイン: /login 以外はすべて弾く(仕様4)
  if (!user) {
    return isLoginPage ? supabaseResponse : redirectTo("/login");
  }

  // 2) ログイン済みだが未承認: 招待コード入力(/join)だけ許可
  if (!approved) {
    return isJoinPage ? supabaseResponse : redirectTo("/join");
  }

  // 3) 承認済み: /login や /join に来たらホームへ
  if (isLoginPage || isJoinPage) {
    return redirectTo("/");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
