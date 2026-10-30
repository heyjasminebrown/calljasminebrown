import type { PrepSheetPayload } from "@/lib/data/prep-sheet";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderPrepSheetEmail(payload: PrepSheetPayload): string {
  const time = new Date(payload.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const afterRows = payload.whatTheyreAfter.map((r) => `<li><strong>${esc(r.label)}:</strong> ${esc(r.value)}</li>`).join("");
  const activityRows = payload.recentActivity
    .map((a) => `<li>${new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${esc(a.label)}</li>`)
    .join("");

  return `
    <h2>${esc(payload.eventTitle)} at ${time}${payload.location ? ` — ${esc(payload.location)}` : ""}</h2>
    <p><strong>${esc(payload.contactName)}</strong></p>
    ${payload.sinceLastSpoke ? `<p>${esc(payload.sinceLastSpoke)}</p>` : ""}
    ${afterRows ? `<h3>What they're after</h3><ul style="padding-left:20px">${afterRows}</ul>` : ""}
    ${payload.notes ? `<h3>Notes on file</h3><p>${esc(payload.notes)}</p>` : ""}
    ${activityRows ? `<h3>Recent activity</h3><ul style="padding-left:20px">${activityRows}</ul>` : ""}
  `;
}
