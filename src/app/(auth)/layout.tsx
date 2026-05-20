import { redirect } from "next/navigation";

import { Logo } from "@/components/layout/Logo";
import { getCurrentUser } from "@/lib/auth";

// Public layout for /login and /signup. If the visitor is already
// authenticated, bounce them home — no point re-signing-in.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <div className="flex w-full max-w-sm flex-col items-stretch gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo size="lg" wordmark="always" />
            <p className="max-w-xs text-balance text-sm text-muted-foreground">
              A behavioural journal for traders. Talk it out, see your patterns.
            </p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
