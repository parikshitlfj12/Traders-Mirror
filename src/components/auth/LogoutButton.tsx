"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoutButtonProps {
  /** Stretch to fill the parent — used in the mobile nav drawer. */
  fullWidth?: boolean;
}

export function LogoutButton({ fullWidth = false }: LogoutButtonProps = {}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (!res.ok) throw new Error("logout failed");
        router.replace("/login");
        router.refresh();
      } catch {
        toast.error("Could not log out — try again.");
      }
    });
  }

  return (
    <Button
      variant={fullWidth ? "outline" : "ghost"}
      size={fullWidth ? "lg" : "sm"}
      disabled={pending}
      onClick={onClick}
      aria-label="Log out"
      className={cn(fullWidth && "w-full justify-center")}
    >
      <LogOutIcon className="size-3.5" />
      <span className={fullWidth ? "" : "hidden sm:inline"}>Log out</span>
    </Button>
  );
}
