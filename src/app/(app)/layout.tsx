import { TopNav } from "@/components/layout/TopNav";
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
        `flex flex-col` lets pages opt into vertical centering via `flex-1`
        on their section. `items-center` then guarantees cross-axis centering
        for every child — `mx-auto` alone is unreliable on flex-column items.
      */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {children}
      </main>
    </div>
  );
}
