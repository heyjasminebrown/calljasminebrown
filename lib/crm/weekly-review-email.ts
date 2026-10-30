import type { WeeklyReviewPayload } from "@/lib/data/weekly-review";
import { APP_NAME } from "@/lib/brand/identity";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain, readable HTML - this lands in her inbox, not the app, so it
// doesn't try to match the app's design tokens, just stays legible in a
// mail client.
export function renderWeeklyReviewEmail(payload: WeeklyReviewPayload): string {
  const statsRow = payload.whatHappened.stats
    .map((s) => `<td style="padding:8px 16px 8px 0"><strong>${s.value}</strong> ${esc(s.label)} <span style="color:#78716c">(${s.previous} last week)</span></td>`)
    .join("");

  const callsList = payload.mondaysCalls
    .map((c, i) => `<li>${i + 1}. <strong>${esc(c.name)}</strong> — ${esc(c.reason)}</li>`)
    .join("");

  const checks: string[] = [];
  if (payload.doubleRegistrations.length > 0) checks.push(`${payload.doubleRegistrations.length} double registration(s) within seconds of each other`);
  if (payload.duplicatePhonePairs.length > 0) checks.push(`${payload.duplicatePhonePairs.length} possible duplicate(s) sharing a phone number`);
  if (payload.noPhoneRegistrantsCount > 0) checks.push(`${payload.noPhoneRegistrantsCount} registrant(s) this week with no phone number`);
  if (payload.possiblyKnownPersonally.length > 0) checks.push(`${payload.possiblyKnownPersonally.length} new registrant(s) who might already be someone you know`);

  return `
    <h2>Your weekly review</h2>
    <p>${esc(payload.whatHappened.summary)}</p>
    <table><tr>${statsRow}</tr></table>
    <p><strong>${payload.whatHappened.underContractNow}</strong> under contract right now.</p>

    ${
      callsList
        ? `<h3>Monday's calls</h3><ol style="padding-left:20px">${callsList}</ol>`
        : ""
    }

    ${
      checks.length > 0
        ? `<h3>Worth double-checking</h3><ul style="padding-left:20px">${checks.map((c) => `<li>${esc(c)}</li>`).join("")}</ul><p style="color:#78716c;font-size:13px">These checks run whether or not you ever turn automation on.</p>`
        : ""
    }

    <p style="margin-top:24px"><a href="${esc(process.env.APP_BASE_URL ?? "")}">Open ${esc(APP_NAME)}</a> to review and act on any of this.</p>
  `;
}
