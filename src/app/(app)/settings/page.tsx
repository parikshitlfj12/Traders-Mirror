import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Email", value: user.email },
    { label: "Display name", value: user.displayName ?? "—" },
    { label: "Primary market", value: user.primaryMarket },
    { label: "Timezone", value: user.timezone },
  ];

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5 py-2 sm:gap-6 sm:py-4">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Settings
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Read-only for now. Editing lands post-MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-0.5 border-b border-border/50 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium break-all sm:text-right">
                {row.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
