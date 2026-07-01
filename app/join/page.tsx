import { JoinForm } from "@/components/auth/JoinForm";

export const dynamic = "force-dynamic";

export default function JoinPage() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <JoinForm />
    </div>
  );
}
