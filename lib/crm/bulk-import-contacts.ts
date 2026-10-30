export interface ParsedContactRow {
  line: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  leadDate: string | null;
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
  phone: "phone",
  "phone number": "phone",
  "buyer phone number": "phone",
  "buyer phone": "phone",
  "attendee phone number": "phone",
  mobile: "phone",
  cell: "phone",
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
};

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseBulkContacts(text: string): { rows: ParsedContactRow[]; unmatchedHeaders: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], unmatchedHeaders: [] };

  const headerCells = splitLine(lines[0]).map(normalizeHeader);
  const fieldByIndex = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
  const unmatchedHeaders = headerCells.filter((h, i) => h && !fieldByIndex[i]);

  const rows: ParsedContactRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
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
    const phone = byField.phone || null;

    const errors: string[] = [];
    if (emailRaw && !email) errors.push(`Doesn't look like a valid email: "${emailRaw}"`);
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

    rows.push({ line: i + 1, firstName, lastName, email, phone, leadDate, errors });
  }

  return { rows, unmatchedHeaders };
}
