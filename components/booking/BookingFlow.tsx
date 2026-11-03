"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, Check, LayoutGrid, List } from "lucide-react";
import { getBookingFlowData, startBookingSession, selectBookingSlot, confirmBooking, type BookingFlowData, type PublicCalendar } from "@/app/book/booking-actions";
import { CalendarGridView } from "@/components/booking/CalendarGridView";
import { ListView } from "@/components/booking/ListView";
import { BookingSteps } from "@/components/booking/BookingSteps";
import { APP_TIMEZONE } from "@/lib/format-time";
import { OWNER_FIRST_NAME } from "@/lib/brand/identity";
import type { Slot } from "@/lib/crm/booking-availability";
import "./booking.css";

type Step = "choose" | "info" | "time" | "details" | "done";
const STEP_NUMBER: Record<Step, number> = { choose: 1, info: 1, time: 2, details: 3, done: 3 };

function parseFixture(value: string | null | undefined): Step | null {
  if (value === "info" || value === "time" || value === "details" || value === "done") return value;
  return null;
}

// Embedded on heyjasminebrown.com/meet: tell the parent page how tall the
// booking flow is, so the frame grows with it (no inner scrollbar).
function useReportHeight(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || window.parent === window) return;
    // Measure the booking content itself (the page's own height never
    // drops below the frame's, so it could only ever grow).
    const target = () => document.querySelector<HTMLElement>("main.bk");
    const send = () => {
      const el = target();
      if (el) window.parent.postMessage({ type: "cjb-booking-height", height: Math.ceil(el.getBoundingClientRect().height) }, "*");
    };
    send();
    const observer = new ResizeObserver(send);
    const watch = () => {
      const el = target();
      if (el) observer.observe(el);
    };
    watch();
    // The <main> is swapped between loading and loaded states.
    const mutations = new MutationObserver(() => {
      observer.disconnect();
      watch();
      send();
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [enabled]);
}

const TZ_NOTE = "Times are Eastern (ET)";

// Stable sample times for screenshots. Never written, and never used unless
// ?fixture= is set. The anchor is fixed so server and client markup match.
function fixtureSlots(): Slot[] {
  const slots: Slot[] = [];
  const [y, m, d] = [2026, 10, 6];
  for (let offset = -2; offset <= 10; offset++) {
    const probe = new Date(Date.UTC(y, m - 1, d + offset));
    const dow = probe.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (const [hh, mm] of [
      [14, 0],
      [14, 30],
      [15, 30],
      [16, 0],
      [18, 0],
      [19, 30],
    ] as const) {
      const start = new Date(Date.UTC(y, m - 1, d + offset, hh, mm, 0));
      slots.push({ startAt: start.toISOString(), endAt: new Date(start.getTime() + 20 * 60_000).toISOString() });
    }
  }
  return slots;
}

export function BookingFlow({
  slug,
  calendarSlug = null,
  embed = false,
  presentation = "page",
  fixture = null,
}: {
  slug: string | null;
  calendarSlug?: string | null;
  embed?: boolean;
  presentation?: "page" | "sheet";
  fixture?: string | null;
}) {
  useReportHeight(embed);
  const fixtureStep = parseFixture(fixture);
  const sampleSlots = fixtureStep ? fixtureSlots() : [];
  const sampleCalendar: PublicCalendar = { slug: "intro-call", name: "Intro call", description: null, durationMinutes: 20 };
  const [chosen, setChosen] = useState<string | null>(calendarSlug);
  const [data, setData] = useState<BookingFlowData | null | "loading">(
    fixtureStep ? { calendar: sampleCalendar, choices: null, durationMinutes: 20, prefill: null, slots: sampleSlots } : "loading",
  );
  const [step, setStep] = useState<Step>(fixtureStep ?? "info");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">(presentation === "sheet" ? "list" : "calendar");

  const [name, setName] = useState(fixtureStep && fixtureStep !== "info" ? "Jordan Sample" : "");
  const [phone, setPhone] = useState(fixtureStep && fixtureStep !== "info" ? "(555) 010-0000" : "");
  const [email, setEmail] = useState(fixtureStep && fixtureStep !== "info" ? "jordan@example.com" : "");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(fixtureStep === "details" || fixtureStep === "done" ? sampleSlots[2]?.startAt ?? null : null);
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<{ confirmed: boolean; meetLink: string | null } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fixtureStep) return;
    let cancelled = false;
    setData("loading");
    getBookingFlowData(slug, chosen).then((loaded) => {
      if (cancelled) return;
      setData(loaded);
      if (loaded?.choices && !chosen) setStep("choose");
      else setStep((s) => (s === "choose" ? "info" : s));
      if (loaded?.prefill) {
        setName(loaded.prefill.name);
        setPhone(loaded.prefill.phone);
        setEmail(loaded.prefill.email);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, chosen, fixtureStep]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const infoReady = !!name.trim() && !!phone.trim() && emailOk;

  async function submitInfo() {
    if (!infoReady || data === "loading" || !data) return;
    if (fixtureStep) {
      setStep("time");
      return;
    }
    setSubmitting(true);
    setError("");
    const started = await startBookingSession({ slug, calendarSlug: data.calendar.slug, name: name.trim(), phone: phone.trim(), email: email.trim() });
    setSubmitting(false);
    if (started.ok) {
      setSessionId(started.sessionId);
      setStep("time");
    } else {
      setError(started.error);
    }
  }

  async function submitTime() {
    if (!selectedSlot) return;
    if (fixtureStep) {
      setStep("details");
      return;
    }
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    const picked = await selectBookingSlot(sessionId, selectedSlot);
    setSubmitting(false);
    if (picked.ok) setStep("details");
    else setError(picked.error);
  }

  async function submitDetails() {
    if (fixtureStep) {
      setStep("done");
      return;
    }
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    const booked = await confirmBooking(sessionId, { topic });
    setSubmitting(false);
    if (booked.ok) {
      setResult({ confirmed: booked.confirmed, meetLink: booked.meetLink });
      setStep("done");
    } else {
      setError(booked.error);
    }
  }

  // The original app had a second "sheet" presentation here, embedded
  // inside its (excluded) listing/offering-memorandum page. This chassis
  // only ever renders the standalone "page" presentation; add your own
  // embedded variant if you need one.

  const mainClass = embed ? "bk bk-embed" : "bk";

  if (data === "loading") {
    return (
      <main className={mainClass}>
        <p className="bk-empty">Loading…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={mainClass}>
        <p className="bk-empty">This booking link isn&apos;t available right now. Please reach out to {OWNER_FIRST_NAME} directly.</p>
      </main>
    );
  }

  const when = selectedSlot ? formatInTimeZone(selectedSlot, APP_TIMEZONE, "EEEE, MMM d 'at' h:mm a") : "";

  return (
    <main className={mainClass}>
      <div className="bk-col">
        {step === "done" ? (
          <div className="bk-card bk-done">
            <div className="bk-check">
              <Check size={22} />
            </div>
            {result?.confirmed === false ? (
              <>
                <h2>
                  Request <em>received!</em>
                </h2>
                <p>
                  {when} ET — {OWNER_FIRST_NAME} will confirm shortly and text you at {phone}.
                </p>
              </>
            ) : (
              <>
                <h2>
                  You&apos;re <em>booked!</em>
                </h2>
                <p>
                  {data.calendar.name} with {OWNER_FIRST_NAME} on {when} ET. A calendar invite with the video link is on its way to {email}, and you&apos;ll get a text confirmation at {phone}.
                </p>
              </>
            )}
          </div>
        ) : step === "choose" && data.choices ? (
          <>
            <div className="bk-head">
              <CalendarClock size={22} />
              <div>
                <h1>
                  Book time with <em>{OWNER_FIRST_NAME}</em>
                </h1>
                <p>Pick the kind of meeting</p>
              </div>
            </div>
            <div className="bk-choices">
              {data.choices.map((c) => (
                <button key={c.slug} type="button" className="bk-card bk-choice" onClick={() => setChosen(c.slug)}>
                  <b>{c.name}</b>
                  <span>{c.durationMinutes} minutes</span>
                  {c.description && <small>{c.description}</small>}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="bk-head">
              <CalendarClock size={22} />
              <div>
                <h1>
                  {data.calendar.name} with <em>{OWNER_FIRST_NAME}</em>
                </h1>
                <p>{data.durationMinutes} minutes · video call</p>
              </div>
              <span className="bk-stepn">Step {STEP_NUMBER[step]} of 3</span>
            </div>
            {data.calendar.description && <p className="bk-desc">{data.calendar.description}</p>}
            {data.choices && step === "info" && (
              <button type="button" className="bk-back" onClick={() => setStep("choose")}>
                ← Other meeting types
              </button>
            )}
            <BookingSteps step={step === "choose" ? "info" : step} />
            <div className="bk-card">
              {step === "info" && (
                <>
                  <div className="bk-field">
                    <label htmlFor="book-name">
                      Your name <small>(required)</small>
                    </label>
                    <input id="book-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required autoComplete="name" />
                  </div>
                  <div className="bk-field">
                    <label htmlFor="book-phone">
                      Phone <small>(required)</small>
                    </label>
                    <input id="book-phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="(555) 555-1234" required autoComplete="tel" />
                  </div>
                  <div className="bk-field">
                    <label htmlFor="book-email">
                      Email <small>(required - your calendar invite goes here)</small>
                    </label>
                    <input id="book-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
                  </div>
                  {error && <p className="bk-error">{error}</p>}
                  {!infoReady && <p className="bk-hint">Add your name, phone and email to see available times.</p>}
                  <button type="button" className="bk-primary" onClick={submitInfo} disabled={submitting || !infoReady}>
                    {submitting ? "…" : "Next"}
                  </button>
                </>
              )}

              {step === "time" && (
                <>
                  <div className="bk-views">
                    <span className="bk-tz">{TZ_NOTE}</span>
                    <div>
                      <button type="button" className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>
                        <LayoutGrid size={12} /> Calendar
                      </button>
                      <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                        <List size={12} /> List
                      </button>
                    </div>
                  </div>
                  {data.slots.length === 0 ? (
                    <p className="bk-empty">No open times right now - check back soon or reach out to {OWNER_FIRST_NAME} directly.</p>
                  ) : view === "calendar" ? (
                    <CalendarGridView slots={data.slots} selected={selectedSlot} onSelect={setSelectedSlot} />
                  ) : (
                    <ListView slots={data.slots} selected={selectedSlot} onSelect={setSelectedSlot} />
                  )}
                  {error && <p className="bk-error">{error}</p>}
                  <div className="bk-nav">
                    <button type="button" className="bk-outline" onClick={() => setStep("info")}>
                      Back
                    </button>
                    <button type="button" className="bk-primary" onClick={submitTime} disabled={submitting || !selectedSlot}>
                      {submitting ? "…" : "Next"}
                    </button>
                  </div>
                </>
              )}

              {step === "details" && (
                <>
                  {selectedSlot && <p className="bk-picked">{when} ET</p>}
                  <div className="bk-field">
                    <label htmlFor="book-topic">
                      What would you like to talk about? <small>(optional)</small>
                    </label>
                    <textarea id="book-topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} />
                  </div>
                  {error && <p className="bk-error">{error}</p>}
                  <div className="bk-nav" style={{ border: 0, paddingTop: 4, marginTop: 6 }}>
                    <button type="button" className="bk-outline" onClick={() => setStep("time")}>
                      Back
                    </button>
                    <button type="button" className="bk-primary" onClick={submitDetails} disabled={submitting}>
                      {submitting ? "Booking…" : "Book it"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
