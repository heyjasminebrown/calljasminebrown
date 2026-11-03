import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthorizedGoogleClient } from "@/lib/google/oauth";
import { listUpcomingEvents } from "@/lib/google/calendar";
import { checkOutlookCalendar } from "@/lib/outlook/busy";
import { formatLocal } from "@/lib/format-time";

// What the CRM actually sees from each calendar it checks for busy times.
export async function CalendarStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [googleClient, outlook] = await Promise.all([getAuthorizedGoogleClient(admin, user.id), checkOutlookCalendar(7)]);
  const googleEvents = googleClient ? await listUpcomingEvents(admin, user.id, now.toISOString(), weekOut.toISOString()) : [];

  return (
    <div className="space-y-4 p-4 text-sm">
      <div>
        <p className="font-semibold text-neutral-900">Google Calendar</p>
        {googleClient ? (
          <p className="text-neutral-600">Connected · {googleEvents.length} event{googleEvents.length === 1 ? "" : "s"} in the next 7 days</p>
        ) : (
          <p className="font-medium text-red-600">Not connected - connect Google in Settings.</p>
        )}
      </div>

      <div>
        <p className="font-semibold text-neutral-900">Outlook (work)</p>
        {!outlook.configured ? (
          <p className="font-medium text-red-600">
            The CRM can&apos;t see OUTLOOK_CALENDAR_ICS_URL. In Vercel, check it&apos;s saved for <b>Production</b>, then redeploy.
          </p>
        ) : !outlook.ok ? (
          <p className="font-medium text-red-600">
            Couldn&apos;t read it ({outlook.host}): {outlook.error}
          </p>
        ) : (
          <>
            <p className="text-neutral-600">
              Read from {outlook.host} · {outlook.stats.events} event{outlook.stats.events === 1 ? "" : "s"} in the feed ({outlook.stats.repeating} repeating,{" "}
              {outlook.stats.skippedFree} marked free) · {outlook.blocks.length} busy time{outlook.blocks.length === 1 ? "" : "s"} in the next 7 days
            </p>
            {outlook.blocks.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-neutral-600">
                {outlook.blocks.slice(0, 10).map((b) => (
                  <li key={`${b.start}-${b.end}`}>
                    {formatLocal(new Date(b.start), "EEE, MMM d · h:mm a")} - {formatLocal(new Date(b.end), "h:mm a")}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-xs text-neutral-400">
              Event types: {Object.entries(outlook.stats.busyStatuses).map(([k, v]) => `${k} ×${v}`).join(", ") || "none"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
