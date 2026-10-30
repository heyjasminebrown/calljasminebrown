"use client";

import { useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarClock, Check, LayoutGrid, List } from "lucide-react";
import { getBookingFlowData, startBookingSession, selectBookingSlot, submitBookingDetails, type BookingFlowData } from "@/app/book/booking-actions";
import { CalendarGridView } from "@/components/booking/CalendarGridView";
import { ListView } from "@/components/booking/ListView";
import { BookingSteps } from "@/components/booking/BookingSteps";
import { BOOKING_CONTACT_TYPE_OPTIONS } from "@/lib/crm/booking-form-options";
import { TIMELINE_LABELS } from "@/lib/utils";
import { APP_TIMEZONE } from "@/lib/format-time";
import { OWNER_FIRST_NAME } from "@/lib/brand/identity";
import type { Slot } from "@/lib/crm/booking-availability";
import type { BookingContactType, Timeline } from "@/types/database";
import "./booking.css";

type Step = "info" | "time" | "details" | "done";
const STEP_NUMBER: Record<Step, number> = { info: 1, time: 2, details: 3, done: 3 };

function parseFixture(value: string | null | undefined): Step | null {
  if (value === "info" || value === "time" || value === "details" || value === "done") return value;
  return null;
}

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
  presentation = "page",
  onClose,
  fixture = null,
}: {
  slug: string | null;
  presentation?: "page" | "sheet";
  onClose?: () => void;
  fixture?: string | null;
}) {
  const fixtureStep = parseFixture(fixture);
  const sampleSlots = fixtureStep ? fixtureSlots() : [];
  const [data, setData] = useState<BookingFlowData | null | "loading">(
    fixtureStep ? { durationMinutes: 20, prefill: null, slots: sampleSlots } : "loading",
  );
  const [step, setStep] = useState<Step>(fixtureStep ?? "info");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">(presentation === "sheet" ? "list" : "calendar");

  const [name, setName] = useState(fixtureStep && fixtureStep !== "info" ? "Jordan Sample" : "");
  const [phone, setPhone] = useState(fixtureStep && fixtureStep !== "info" ? "(555) 010-0000" : "");
  const [email, setEmail] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(fixtureStep === "details" || fixtureStep === "done" ? sampleSlots[2]?.startAt ?? null : null);
  const [contactType, setContactType] = useState<BookingContactType | "">("");
  const [timeline, setTimeline] = useState<Timeline | "">("");
  const [questions, setQuestions] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fixtureStep) return;
    let cancelled = false;
    getBookingFlowData(slug).then((result) => {
      if (cancelled) return;
      setData(result);
      if (result?.prefill) {
        setName(result.prefill.name);
        setPhone(result.prefill.phone);
        setEmail(result.prefill.email);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, fixtureStep]);

  async function submitInfo() {
    if (!name.trim() || !phone.trim()) return;
    if (fixtureStep) {
      setStep("time");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await startBookingSession({ slug, name: name.trim(), phone: phone.trim(), email: email.trim() });
    setSubmitting(false);
    if (result.ok) {
      setSessionId(result.sessionId);
      setStep("time");
    } else {
      setError(result.error);
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
    const result = await selectBookingSlot(sessionId, selectedSlot);
    setSubmitting(false);
    if (result.ok) setStep("details");
    else setError(result.error);
  }

  async function submitDetails() {
    if (fixtureStep) {
      setStep("done");
      return;
    }
    if (!sessionId) return;
    setSubmitting(true);
    setError("");
    const result = await submitBookingDetails(sessionId, {
      contactType: contactType || null,
      timeline: timeline || null,
      questions,
    });
    setSubmitting(false);
    if (result.ok) setStep("done");
    else setError(result.error);
  }

  // The original app had a second "sheet" presentation here, embedded
  // inside its (excluded) listing/offering-memorandum page. This chassis
  // only ever renders the standalone "page" presentation; add your own
  // embedded variant if you need one.

  if (data === "loading") {
    return (
      <main className="bk">
        <p className="bk-empty">Loading…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="bk">
        <p className="bk-empty">This link isn&apos;t valid anymore. Ask {OWNER_FIRST_NAME} to send a fresh one.</p>
      </main>
    );
  }

  return (
    <main className="bk">
      <div className="bk-col">
        {step === "done" ? (
          <div className="bk-card bk-done">
            <div className="bk-check">
              <Check size={22} />
            </div>
            <h2>
              Request <em>sent!</em>
            </h2>
            <p>
              {selectedSlot && (
                <>
                  {formatInTimeZone(selectedSlot, APP_TIMEZONE, "EEEE, MMM d 'at' h:mm a")} — {OWNER_FIRST_NAME} will confirm shortly and text you at {phone}.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="bk-head">
              <CalendarClock size={22} />
              <div>
                <h1>
                  Book time with <em>{OWNER_FIRST_NAME}</em>
                </h1>
                <p>{data.durationMinutes} minutes</p>
              </div>
              <span className="bk-stepn">Step {STEP_NUMBER[step]} of 3</span>
            </div>
            <BookingSteps step={step} />
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
                      Email <small>(optional)</small>
                    </label>
                    <input id="book-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
                  </div>
                  {error && <p className="bk-error">{error}</p>}
                  {(!name.trim() || !phone.trim()) && (
                    <p className="bk-hint">Add your name and phone to continue — {OWNER_FIRST_NAME} uses them to confirm the meeting.</p>
                  )}
                  <button type="button" className="bk-primary" onClick={submitInfo} disabled={submitting || !name.trim() || !phone.trim()}>
                    {submitting ? "…" : "Next"}
                  </button>
                </>
              )}

              {step === "time" && (
                <>
                  <div className="bk-views">
                    <div>
                      <button type="button" className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")}>
                        <LayoutGrid size={12} /> Calendar
                      </button>
                      <button type="button" className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                        <List size={12} /> List
                      </button>
                    </div>
                  </div>
                  {view === "calendar" ? (
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
                  <p className="bk-prep">Help me prepare for this meeting:</p>
                  {selectedSlot && <p className="bk-picked">{formatInTimeZone(selectedSlot, APP_TIMEZONE, "EEEE, MMM d 'at' h:mm a")}</p>}
                  <div className="bk-field">
                    <span className="bk-label">
                      What best describes you? <small>(optional)</small>
                    </span>
                    <div className="bk-chips">
                      {BOOKING_CONTACT_TYPE_OPTIONS.map((o) => {
                        const active = contactType === o.value;
                        return (
                          <button key={o.value} type="button" className={active ? "sel" : ""} onClick={() => setContactType(active ? "" : o.value)}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="bk-field">
                    <label htmlFor="book-timeline">
                      Timeline <small>(optional)</small>
                    </label>
                    <select id="book-timeline" value={timeline} onChange={(e) => setTimeline(e.target.value as Timeline | "")}>
                      <option value="">Not sure yet</option>
                      {Object.entries(TIMELINE_LABELS)
                        .filter(([value]) => value !== "unknown")
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="bk-field">
                    <label htmlFor="book-questions">
                      Anything you&apos;d like to share or specific topics you&apos;d like to cover? <small>(optional)</small>
                    </label>
                    <textarea id="book-questions" value={questions} onChange={(e) => setQuestions(e.target.value)} rows={3} />
                  </div>
                  {error && <p className="bk-error">{error}</p>}
                  <div className="bk-nav" style={{ border: 0, paddingTop: 4, marginTop: 6 }}>
                    <button type="button" className="bk-outline" onClick={() => setStep("time")}>
                      Back
                    </button>
                    <button type="button" className="bk-primary" onClick={submitDetails} disabled={submitting}>
                      {submitting ? "Sending…" : "Request this time"}
                    </button>
                  </div>
                  <p className="bk-conf">{OWNER_FIRST_NAME} confirms every request before it&apos;s final.</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
