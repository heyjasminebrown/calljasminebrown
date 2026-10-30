import { z } from "zod";

export const contactSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  secondary_phone: z.string().optional(),
  contact_type: z.enum([
    "buyer",
    "seller",
    "both",
    "investor",
    "renter",
    "referral_partner",
    "vendor",
    "past_client",
    "sphere",
    "attendee",
    "agent",
    "other",
  ]),
  representing: z.union([z.enum(["buyer", "seller", "both"]), z.literal("")]).nullable().optional(),
  listing_address: z.string().optional(),
  listing_timeline: z
    .union([
      z.enum(["asap", "1_3_months", "3_6_months", "6_12_months", "12_plus_months", "just_browsing", "unknown"]),
      z.literal(""),
    ])
    .nullable()
    .optional(),
  stage_id: z.string().uuid().nullable().optional(),
  lead_source: z.string().optional(),
  lead_date: z.string().optional(),
  budget_min: z.union([z.coerce.number(), z.nan()]).optional(),
  budget_max: z.union([z.coerce.number(), z.nan()]).optional(),
  referral_fee: z.union([z.coerce.number(), z.nan()]).optional(),
  areas_of_interest: z.string().optional(),
  timeline: z.enum(["asap", "1_3_months", "3_6_months", "6_12_months", "12_plus_months", "just_browsing", "unknown"]),
  next_follow_up_at: z.string().optional(),
  birthday: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  notes: z.string().optional(),
  tag_ids: z.array(z.string().uuid()).optional(),
  referred_by: z.union([z.string().uuid(), z.literal("")]).nullable().optional(),
  lease_ends_at: z.string().optional(),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
