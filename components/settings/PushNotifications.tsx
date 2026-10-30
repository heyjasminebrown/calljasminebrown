"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Bell, BellOff } from "lucide-react";
import { APP_NAME } from "@/lib/brand/identity";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

type Status = "checking" | "unsupported" | "needs-install" | "off" | "on" | "denied";

export function PushNotifications({ vapidPublicKey }: { vapidPublicKey: string | undefined }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    // iOS Safari only allows Web Push for a PWA added to the Home Screen -
    // a regular browser tab silently can't subscribe there.
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (isIOS && !isStandalone) {
      setStatus("needs-install");
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    setStatus(existing ? "on" : "off");
  }

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setBusy(false);
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Save failed");
      setStatus("on");
    } catch {
      setError("Couldn't enable notifications. Try again.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Couldn't disable notifications. Try again.");
    }
    setBusy(false);
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return <p className="text-[15px] leading-[23px] text-neutral-500">Push notifications aren&apos;t supported in this browser.</p>;
  }

  if (status === "needs-install") {
    return (
      <p className="text-[15px] leading-[23px] text-neutral-500">
        On iPhone, add {APP_NAME} to your Home Screen first (Share → Add to Home Screen), then come back here to turn on
        notifications.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-[15px] leading-[23px] text-neutral-500">
        Notifications are blocked for this site in your browser settings. Enable them there, then reload this page.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3.5">
      <p className="min-w-0 flex-1 text-[16px] leading-6 text-neutral-700">Push on this device</p>
      {status === "on" ? (
        <Button variant="secondary" size="sm" onClick={disable} disabled={busy}>
          <BellOff size={14} /> {busy ? "Turning off…" : "Turn off"}
        </Button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-[10px] border-0 bg-neutral-900 px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Bell size={14} /> {busy ? "Turning on…" : "Turn on"}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
