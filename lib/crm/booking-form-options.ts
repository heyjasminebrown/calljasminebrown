import type { BookingContactType } from "@/types/database";

// Curated subset of the CRM's own contact types - only what a stranger
// booking time could meaningfully self-select. Labels match
// CONTACT_TYPE_LABELS (lib/utils.ts) so the same word means the same
// thing whether she typed it or they did.
export const BOOKING_CONTACT_TYPE_OPTIONS: { value: BookingContactType; label: string }[] = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "both", label: "Buyer & Seller" },
  { value: "investor", label: "Investor" },
  { value: "renter", label: "Renter" },
  { value: "referral_partner", label: "Referral Partner" },
  { value: "vendor", label: "Vendor" },
  { value: "other", label: "Other / Not sure yet" },
];
