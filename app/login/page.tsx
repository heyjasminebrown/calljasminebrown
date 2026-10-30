"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button, Input, Label } from "@/components/ui";
import { safeInternalPath } from "@/lib/auth/safe-path";

function LoginForm() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error") === "auth";
  const next = safeInternalPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function sendLink(keepSent = false) {
    if (!keepSent) setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendLink();
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7f1ea] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandWordmark size="lg" className="inline-block" />
          <p className="mt-1 text-sm text-neutral-500">We&apos;ll email a magic link — no password. It expires in about an hour.</p>
        </div>

        {authError && status !== "sent" && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            That sign-in link expired or isn&apos;t valid. Request a new one below.
          </p>
        )}

        {status === "sent" ? (
          <div className="rounded-2xl border border-[#eadfd6] bg-[#fffbf8] p-6 text-center shadow-card">
            <p className="text-sm text-neutral-700">
              Check <span className="font-medium">{email}</span> for a sign-in link. It expires in about an hour.
            </p>
            <p className="mt-2 text-sm text-neutral-500">If it isn&apos;t there, look in spam or promotions, then resend below.</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => void sendLink(true)}>Resend link</Button>
              <Button variant="ghost" onClick={() => setStatus("idle")}>
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-[#eadfd6] bg-[#fffbf8] p-6 shadow-card">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {status === "error" && (
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            )}
            <Button type="submit" className="mt-4 w-full" disabled={status === "sending"}>
              {status === "sending" ? "Sending link…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[#f7f1ea] px-4">
          <p className="text-sm text-neutral-500">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
