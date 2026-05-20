import { redirect } from "next/navigation";

import { TopNav } from "@/components/layout/TopNav";
import { getCurrentUser } from "@/lib/auth";

// Protected layout for every authenticated page. Guard logic lives here so
// individual pages stay focused on their own concerns (PRD §4 decision #7).
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav user={{ email: user.email, displayName: user.displayName }} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
