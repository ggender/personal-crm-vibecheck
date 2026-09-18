import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { LoginForm } from "@/features/auth/components/login-form";
import { getCurrentUser } from "@/features/auth/session";

export const metadata: Metadata = { title: "Вход — Личная CRM" };

// Better Auth sends a failed login link here with ?error=CODE.
function linkProblem(error: string | string[] | undefined): string | null {
  if (error === undefined) {
    return null;
  }
  return error === "INVALID_TOKEN"
    ? "Ссылка для входа устарела или уже использована — получи новую."
    : "Не удалось войти по этой ссылке — получи новую.";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // The session is checked on every request, never at build time.
  await connection();
  if (await getCurrentUser()) {
    redirect("/");
  }
  const problem = linkProblem((await searchParams).error);

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm space-y-5 rounded-xl border bg-card p-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Личная CRM</h1>
          <p className="text-sm text-muted-foreground">
            Вход по ссылке из письма — без пароля.
          </p>
        </div>
        {problem && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {problem}
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
