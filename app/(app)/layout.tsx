import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/Sidebar";
import { BottomNav } from "@/components/nav/BottomNav";
import { QuickAddButton } from "@/components/nav/QuickAddButton";
import { LogPill } from "@/components/nav/LogPill";
import { SystemErrorsBanner } from "@/components/system/SystemErrorsBanner";
import { inboxOwedCount, listConversations } from "@/lib/data/messages";
import { listEventFollowupQueue, listConfirmationQueue } from "@/lib/data/dialer";
import { getUnmatchedNotesCount } from "@/lib/data/notes-inbox";
import { getSuggestionQueue } from "@/lib/data/insights";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: contactsCount }, conversations, { contacts: followups }, { items: confirmations }, unmatchedNotes, suggestionQueue] =
    await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("archived", false).eq("spam", false),
      listConversations(),
      listEventFollowupQueue(),
      listConfirmationQueue(),
      getUnmatchedNotesCount(),
      getSuggestionQueue(),
    ]);
  const waitingOnReply = inboxOwedCount(conversations);
  const navCounts = {
    contacts: contactsCount ?? 0,
    // Post-event follow-ups + booking confirmations due a call.
    dialer: followups.length + confirmations.length,
    messages: waitingOnReply,
    notes: unmatchedNotes,
    insights: suggestionQueue.count,
  };

  return (
    // Desktop shell starts at lg (1024px) — not md (768). Below that the
    // phone 5-tab bar stays; at 1024+ the sidebar is a real app chrome
    // and <main> is the only scroller (lg:h-dvh + overflow-hidden).
    <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden">
      <Suspense fallback={<aside className="hidden w-[220px] shrink-0 border-r border-[#ddd7da] bg-[#ebeaeb] lg:flex" />}>
        <Sidebar userEmail={user?.email} counts={navCounts} />
      </Suspense>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-hidden">
        <main className="flex flex-1 flex-col bg-[#ebeaeb] pb-[calc(var(--app-bottom-nav)+12px)] lg:min-h-0 lg:overflow-y-auto lg:pb-8">
          <Suspense fallback={null}>
            <SystemErrorsBanner />
          </Suspense>
          {children}
        </main>
      </div>
      {/* Mobile's FAB slot is Today-only-Log now (LogPill below); New
          contact lives on the Contacts header. More is a flat sheet
          (Campaigns · Listings · Commissions · Reports · Settings,
          plus Events on mobile). QuickAddButton stays desktop-only. */}
      <div className="hidden lg:block">
        <QuickAddButton />
      </div>
      {user && <LogPill ownerId={user.id} />}
      <BottomNav counts={navCounts} userEmail={user?.email} />
    </div>
  );
}
