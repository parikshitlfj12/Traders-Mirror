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
        Padding matches the nav's inner container (px-4) so headings and
        cards line up with the brand on the left and the user menu on the
        right at every breakpoint. Pages that want centered hero content
        (Home, Projects) opt in with their own `items-center` on the section.
      */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
