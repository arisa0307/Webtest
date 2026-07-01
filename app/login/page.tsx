import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">Web test</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            薬学部 試験問題データベース
          </p>
        </div>
        <GoogleLoginButton />
        <p className="mt-6 text-center text-xs text-muted-foreground">
          ログインすると利用規約に同意したものとみなします。
        </p>
      </Card>
    </div>
  );
}
