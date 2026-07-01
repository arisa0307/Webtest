import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/auth/SignOutButton";

/** ログイン済みのときだけ表示するヘッダー。 */
export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email, is_admin")
    .eq("id", user.id)
    .single();

  const name = profile?.display_name || profile?.email || "ユーザー";

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-bold tracking-tight">
          Web test
        </Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">
            {name}
            {profile?.is_admin && (
              <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">
                管理者
              </span>
            )}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
