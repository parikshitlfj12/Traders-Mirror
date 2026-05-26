import { TopNav } from "@/components/layout/TopNav";
import { APP_SHELL_CLASS } from "@/components/layout/constants";
import { requirePageUser } from "@/lib/auth";

// Protected layout for every authenticated page. Guard logic lives here so
// individual pages stay focused on their own concerns (PRD §4 decision #7).
export default async function AppLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const user = await requirePageUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav user={{ email: user.email, displayName: user.displayName }} />
      {/*
        APP_SHELL_CLASS matches TopNav inner bounds exactly (max-w-7xl + px).
      */}
      <main
        className={`flex flex-1 flex-col py-6 sm:py-8 ${APP_SHELL_CLASS}`}
      >
        {children}
      </main>
    </div>
  );
}
