import type { RelationshipType } from "@/types/database";
import { RELATIONSHIP_TYPE_LABELS, PIPELINE_STAGE_NAMES } from "@/lib/utils";

export interface ParsedContactRow {
  line: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  leadDate: string | null;
  // From a Type / Stage column when the file has one; null means "use the
  // import's default". Stage is a stage name, matched case-insensitively.
  relationshipType: RelationshipType | null;
  stageName: string | null;
  // Per-row Source (overrides the import's Source), tags (added on top of
  // the import's tags) and a note for the contact's timeline.
  leadSource: string | null;
  tags: string[];
  notes: string | null;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string> = {
  "first name": "firstName",
  first: "firstName",
  "attendee first name": "firstName",
  "buyer first name": "firstName",
  "purchaser first name": "firstName",
  "last name": "lastName",
  last: "lastName",
  "attendee last name": "lastName",
  "buyer last name": "lastName",
  "purchaser last name": "lastName",
  name: "fullName",
  "full name": "fullName",
  "attendee name": "fullName",
  "buyer name": "fullName",
  email: "email",
  "email address": "email",
  "attendee email": "email",
  "buyer email": "email",
  "purchaser email": "email",
  "secondary email": "secondaryEmail",
  "email 2": "secondaryEmail",
  "other email": "secondaryEmail",
  "work email": "secondaryEmail",
  phone: "phone",
  "phone number": "phone",
  "buyer phone number": "phone",
  "buyer phone": "phone",
  "attendee phone number": "phone",
  mobile: "phone",
  cell: "phone",
  type: "relationshipType",
  "relationship type": "relationshipType",
  "contact type": "relationshipType",
  stage: "stageName",
  "pipeline stage": "stageName",
  "relationship stage": "stageName",
  date: "leadDate",
  "lead date": "leadDate",
  "booking date": "leadDate",
  "order date": "leadDate",
  "registration date": "leadDate",
  "signup date": "leadDate",
  "sign up date": "leadDate",
  "date registered": "leadDate",
  "date added": "leadDate",
  "created date": "leadDate",
  created: "leadDate",
  source: "leadSource",
  "lead source": "leadSource",
  "contact source": "leadSource",
  "referral source": "leadSource",
  "how did you hear about us": "leadSource",
  "how did you hear about us?": "leadSource",
  "how did you hear about me": "leadSource",
  "how did you hear about me?": "leadSource",
  tags: "tags",
  tag: "tags",
  labels: "tags",
  label: "tags",
  groups: "tags",
  notes: "notes",
  note: "notes",
  comments: "notes",
  comment: "notes",
  description: "notes",
};

// Several tags in one cell: "VIP; Investor" or "VIP, Investor".
function splitTags(raw: string): string[] {
  return [...new Set(raw.split(/[;,|]/).map((t) => t.trim()).filter(Boolean).map((t) => t.slice(0, 60)))];
}

// The whole file as rows of cells. Handles quoted cells that contain
// commas, quotes ("") and line breaks (a multi-line note exported from
// Excel or Google Sheets). Tab-separated text (pasted from a spreadsheet)
// is detected from the header line.
export function splitRecords(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const records: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const endCell = () => {
    row.push(cur);
    cur = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim().length > 0)) records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"' && cur.trim() === "") {
      inQuotes = true;
      cur = "";
    } else if (c === delimiter) {
      endCell();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cur += c;
    }
  }
  if (cur.length > 0 || row.length > 0) endRow();
  return records;
}

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

// A real exported CSV (e.g. from Eventbrite) can quote fields that contain
// commas - a naive split on "," would cut a quoted "Smith, Jr." style value
// in half. Pasted spreadsheet rows use tabs instead, which never need
// quoting, so those are split on tab whenever a line has one.
// Exported so lib/eventbrite/parse-orders-csv.ts can reuse the exact same
// cell-splitting behavior instead of a second, potentially-drifting copy.
export function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function splitFullName(full: string): { firstName: string | null; lastName: string | null } {
  const trimmed = full.trim();
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function matchRelationshipType(raw: string): RelationshipType | null {
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  const entry = Object.entries(RELATIONSHIP_TYPE_LABELS).find(
    ([value, label]) => label.toLowerCase() === key || value.replace(/_/g, " ") === key,
  );
  return (entry?.[0] as RelationshipType | undefined) ?? null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseBulkContacts(text: string): { rows: ParsedContactRow[]; unmatchedHeaders: string[] } {
  const records = splitRecords(text);
  if (records.length < 2) return { rows: [], unmatchedHeaders: [] };

  const headerCells = records[0].map(normalizeHeader);
  const fieldByIndex = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
  const unmatchedHeaders = headerCells.filter((h, i) => h && !fieldByIndex[i]);

  const rows: ParsedContactRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    const byField: Record<string, string> = {};
    fieldByIndex.forEach((field, idx) => {
      if (field) byField[field] = (cells[idx] ?? "").trim();
    });

    let firstName = byField.firstName || null;
    let lastName = byField.lastName || null;
    if (!firstName && !lastName && byField.fullName) {
      const split = splitFullName(byField.fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }

    const emailRaw = byField.email || null;
    const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
    const secondaryEmailRaw = byField.secondaryEmail || null;
    const secondaryEmail = secondaryEmailRaw && EMAIL_RE.test(secondaryEmailRaw) ? secondaryEmailRaw : null;
    const phone = byField.phone || null;

    const errors: string[] = [];
    if (emailRaw && !email) errors.push(`Doesn't look like a valid email: "${emailRaw}"`);
    if (secondaryEmailRaw && !secondaryEmail) errors.push(`Doesn't look like a valid secondary email: "${secondaryEmailRaw}"`);
    if (!email && !phone) errors.push("No email or phone - can't match or create a contact without one");
    if (!firstName && !lastName) errors.push("No name");

    let leadDate: string | null = null;
    const leadDateRaw = byField.leadDate || null;
    if (leadDateRaw) {
      const parsed = new Date(leadDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        errors.push(`Doesn't look like a valid date: "${leadDateRaw}"`);
      } else {
        leadDate = parsed.toISOString();
      }
    }

    let relationshipType: RelationshipType | null = null;
    const typeRaw = byField.relationshipType || null;
    if (typeRaw) {
      relationshipType = matchRelationshipType(typeRaw);
      if (!relationshipType) {
        errors.push(`Unknown type "${typeRaw}" - use ${Object.values(RELATIONSHIP_TYPE_LABELS).join(", ")}`);
      }
    }

    let stageName: string | null = null;
    const stageRaw = byField.stageName || null;
    if (stageRaw) {
      stageName = PIPELINE_STAGE_NAMES.find((s) => s.toLowerCase() === stageRaw.toLowerCase()) ?? null;
      if (!stageName) errors.push(`Unknown stage "${stageRaw}" - use ${PIPELINE_STAGE_NAMES.join(", ")}`);
    }

    const leadSource = byField.leadSource ? byField.leadSource.slice(0, 100) : null;
    const tags = byField.tags ? splitTags(byField.tags) : [];
    const notes = byField.notes ? byField.notes.slice(0, 5000) : null;

    rows.push({ line: i + 1, firstName, lastName, email, secondaryEmail, phone, leadDate, relationshipType, stageName, leadSource, tags, notes, errors });
  }

  return { rows, unmatchedHeaders };
}
