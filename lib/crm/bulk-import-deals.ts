import type { DealSide } from "@/types/database";

export interface ParsedDealRow {
  line: number;
  clientName: string | null;
  address: string | null;
  closedAt: string | null;
  salePrice: number | null;
  grossCommission: number | null;
  side: DealSide | null;
  referralPct: number | null;
  miscFee: number;
  ozFee: number;
  onFmls: boolean;
  // Only used when the import is set to "use exact fee amounts" - parsed
  // regardless of that setting so switching the toggle after pasting
  // doesn't require re-pasting.
  kwFee: number;
  kwriFee: number;
  fmlsFee: number;
  tcFee: number;
  referralFee: number;
  notes: string | null;
  errors: string[];
}

// Aliases cover both our own simple template AND the literal column names
// on a typical KW-style commission spreadsheet, so a row copied straight
// out of an existing tracker still parses without reformatting first.
const HEADER_ALIASES: Record<string, string> = {
  address: "address",
  property: "address",
  "property address": "address",
  client: "clientName",
  "client name": "clientName",
  name: "clientName",
  "closing date": "closedAt",
  date: "closedAt",
  closed: "closedAt",
  "sale price": "salePrice",
  price: "salePrice",
  "gross comp": "grossCommission",
  "gross comp.": "grossCommission",
  "gross commission": "grossCommission",
  gci: "grossCommission",
  side: "side",
  "referral %": "referralPct",
  "referral pct": "referralPct",
  "referral fees": "referralFee",
  "referral fee": "referralFee",
  referral: "referralPct",
  misc: "miscFee",
  "misc.": "miscFee",
  "misc fee": "miscFee",
  oz: "ozFee",
  "oz fee": "ozFee",
  fmls: "fmls",
  "on fmls": "fmls",
  kw: "kwFee",
  kwri: "kwriFee",
  tc: "tcFee",
  notes: "notes",
};

function normalizeHeader(h: string) {
  return h.trim().toLowerCase();
}

function splitLine(line: string): string[] {
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[%\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseSide(raw: string | undefined): DealSide | null {
  const v = raw?.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith("buy")) return "buyer";
  if (v.startsWith("sell")) return "seller";
  return null;
}

// A blank/missing FMLS column defaults to "on" (the common case, matches
// the checkbox's own default) - only an explicit $0/zero/"no" turns it off.
// Only relevant in computed mode; manual mode uses the FMLS column's
// dollar value directly instead (see fmlsFee).
function parseOnFmls(raw: string | undefined): boolean {
  if (raw === undefined || raw.trim() === "") return true;
  const v = raw.trim().toLowerCase();
  if (v === "no" || v === "n" || v === "false") return false;
  if (v === "yes" || v === "y" || v === "true") return true;
  const n = parseMoney(raw);
  return n !== 0;
}

export function parseBulkDeals(text: string): { rows: ParsedDealRow[]; unmatchedHeaders: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], unmatchedHeaders: [] };

  const headerCells = splitLine(lines[0]).map(normalizeHeader);
  const fieldByIndex = headerCells.map((h) => HEADER_ALIASES[h] ?? null);
  const unmatchedHeaders = headerCells.filter((h, i) => h && !fieldByIndex[i]);

  const rows: ParsedDealRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const byField: Record<string, string> = {};
    fieldByIndex.forEach((field, idx) => {
      if (field) byField[field] = cells[idx] ?? "";
    });

    const address = byField.address?.trim() || null;
    const clientName = byField.clientName?.trim() || null;
    const closedAt = parseDate(byField.closedAt);
    const errors: string[] = [];
    if (byField.closedAt && !closedAt) errors.push(`Couldn't parse closing date "${byField.closedAt}"`);
    if (!closedAt) errors.push("Missing/invalid closing date");
    if (!address && !clientName) errors.push("No address or client name");

    rows.push({
      line: i + 1,
      clientName,
      address,
      closedAt,
      salePrice: parseMoney(byField.salePrice),
      grossCommission: parseMoney(byField.grossCommission),
      side: parseSide(byField.side),
      referralPct: parsePercent(byField.referralPct),
      miscFee: parseMoney(byField.miscFee) ?? 0,
      ozFee: parseMoney(byField.ozFee) ?? 0,
      onFmls: parseOnFmls(byField.fmls),
      kwFee: parseMoney(byField.kwFee) ?? 0,
      kwriFee: parseMoney(byField.kwriFee) ?? 0,
      fmlsFee: parseMoney(byField.fmls) ?? 0,
      tcFee: parseMoney(byField.tcFee) ?? 0,
      referralFee: parseMoney(byField.referralFee) ?? 0,
      notes: byField.notes?.trim() || null,
      errors,
    });
  }

  return { rows, unmatchedHeaders };
}
