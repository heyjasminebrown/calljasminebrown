import { clsx, type ClassValue } from "clsx";
import type { RelationshipType } from "@/types/database";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(firstName: string, lastName?: string | null) {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function fullName(c: { first_name: string; last_name?: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
}

function asMetaString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function titleCaseWord(word: string): string {
  if (!word) return "";
  return word
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part))
    .join("-");
}

function lettersOnly(value: string): string {
  return value.replace(/[^A-Za-z]/g, "");
}

function isUniformCasing(value: string): boolean {
  const letters = lettersOnly(value);
  if (!letters) return false;
  return letters === letters.toLowerCase() || letters === letters.toUpperCase();
}

// Display-only: "barbara guillory" / "BARBARA GUILLORY" → "Barbara Guillory".
// Mixed-case names (McDonald) stay as stored.
export function displayPersonName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (!isUniformCasing(trimmed)) return trimmed;
  return trimmed.split(" ").map(titleCaseWord).join(" ");
}

export function displayFullName(c: { first_name: string; last_name?: string | null }): string {
  return displayPersonName(fullName(c));
}

function firstNameToken(value: string): string {
  return (value.trim().split(/\s+/)[0] ?? "").replace(/[.,]/g, "");
}

function looksLikeEmailInitials(token: string): boolean {
  return /^[a-z]{1,2}$/i.test(token);
}

export function firstNameFromEmail(email: string | null | undefined): string {
  if (!email) return "";
  const local = email.split("@")[0] ?? "";
  const token = local.split(/[._+-]/)[0] ?? "";
  if (!token || looksLikeEmailInitials(token)) return "";
  return titleCaseWord(token);
}

export function firstNameFromProfile(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined): string {
  const meta = user?.user_metadata ?? {};
  const fromProfile =
    firstNameToken(asMetaString(meta.given_name) || asMetaString(meta.first_name)) ||
    firstNameToken(asMetaString(meta.full_name) || asMetaString(meta.name));
  if (fromProfile) return isUniformCasing(fromProfile) ? titleCaseWord(fromProfile) : fromProfile;
  return firstNameFromEmail(user?.email);
}

// Stable per-person color (same contact always lands on the same color,
// across every avatar anywhere in the app) instead of one flat brand color
// for everyone - makes a conversation list scannable at a glance the way
// Quo's own colored-initials avatars are.
export function formatCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

export function formatCompactCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}k`;
  return formatCurrency(value);
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatPhone(phone?: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// A tracked link's full URL is usually too long to show in a compact list -
// hostname + path is enough to recognize which link it is at a glance.
export function shortenUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

// The contact's one primary relationship (shown as "Type"). Independent of
// Stage; extra designations go on tags.
export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  community: "Community",
  prospect: "Prospect",
  client: "Client",
  referral_partner: "Referral Partner",
};
export const RELATIONSHIP_TYPES = Object.keys(RELATIONSHIP_TYPE_LABELS) as RelationshipType[];
export const DEFAULT_RELATIONSHIP_TYPE: RelationshipType = "community";
// The only pipeline stages (supabase/migrations/0083). Imported and
// auto-created contacts land in Nurture unless a stage is chosen.
export const PIPELINE_STAGE_NAMES = ["Cold", "Warm", "Hot", "Nurture"] as const;
export const DEFAULT_STAGE_NAME = "Nurture";

// One muted palette for the four stages, used everywhere a stage shows a
// color (Settings, Today's Pipeline Overview, reports, message badges) so
// they always match. Falls back to the stored color for anything else.
const STAGE_COLORS: Record<string, string> = {
  Cold: "#7d9cc0",
  Warm: "#d8b85c",
  Hot: "#7aa37a",
  Nurture: "#d98c5f",
};
export function stageColor(stage: { name: string; color: string }): string {
  return STAGE_COLORS[stage.name] ?? stage.color;
}

// Soft background for a stage pill: the stage color at low opacity.
export function stageTint(stage: { name: string; color: string }): string {
  return `${stageColor(stage)}2e`;
}

// Tags aren't color-coded: every tag uses the same neutral pill, and a
// selected tag in a picker uses the brand plum.
export const TAG_CHIP = "bg-[#f4f1f5] text-[#34223a]";
export const TAG_CHIP_SELECTED = "bg-[#34223a] text-peach";

// Type colors reuse the stage palette (same muted tones).
const RELATIONSHIP_TYPE_COLORS: Record<RelationshipType, string> = {
  community: STAGE_COLORS.Nurture,
  prospect: STAGE_COLORS.Hot,
  client: STAGE_COLORS.Warm,
  referral_partner: STAGE_COLORS.Cold,
};
export function relationshipTypeColor(type: RelationshipType): string {
  return RELATIONSHIP_TYPE_COLORS[type] ?? "#a796ab";
}
export function relationshipTypeTint(type: RelationshipType): string {
  return `${relationshipTypeColor(type)}2e`;
}

// Legacy internal category (contact_type) - no longer shown as "Type".
export const CONTACT_TYPE_LABELS: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  both: "Buyer & Seller",
  investor: "Investor",
  renter: "Renter",
  referral_partner: "Referral Partner",
  vendor: "Vendor",
  past_client: "Past Client",
  sphere: "Sphere",
  attendee: "Attendee",
  agent: "Agent",
  other: "Other",
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  primary_residence: "Primary Residence",
  house_hack: "House Hack",
  investment: "Investment",
  co_living: "Co-living",
  other: "Other",
};

export const LEAD_SOURCES = ["Event", "Facebook", "Instagram", "YouTube", "TikTok", "Website", "Conventus"];
