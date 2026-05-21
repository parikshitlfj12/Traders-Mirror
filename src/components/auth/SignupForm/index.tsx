"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AUTH_FIELD_CLASS,
  AUTH_SUBMIT_CLASS,
} from "@/components/auth/constants";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// =============================================================================
// SignupForm — email + (optional) display name + password account creation.
// Posts to /api/auth/signup which both creates the user and starts the
// session, so on success we just route home + refresh.
//
// primaryMarket is intentionally left out — Settings handles it post-signup
// so the first-run experience stays minimal (PRD §1.7).
// =============================================================================

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    start(async () => {
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            displayName: displayName.trim() || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          toast.error(json.error?.message ?? "Could not create account.");
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>One trader. One mirror.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className={AUTH_FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">
              Display name{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="nickname"
              maxLength={64}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={pending}
              className={AUTH_FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              className={AUTH_FIELD_CLASS}
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <Button type="submit" disabled={pending} className={AUTH_SUBMIT_CLASS}>
            {pending ? "Creating account…" : "Create account"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-foreground">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
