// Hand-written types matching supabase/migrations (through 0078).
// If you use the Supabase CLI later, you can replace this with
// `supabase gen types typescript` output.

export type ContactType =
  | "buyer"
  | "seller"
  | "both"
  | "investor"
  | "renter"
  | "referral_partner"
  | "vendor"
  | "past_client"
  | "sphere"
  | "attendee"
  | "agent"
  | "other";

// null (on Contact.recruit_stage) = top of funnel, "Potential" - every
// contact tagged "Agent" by default, no separate value stored for it.
export type RecruitStage = "introduced" | "connected_with_lead" | "joined" | "fee_received" | "not_moving_forward";

export type Timeline =
  | "asap"
  | "1_3_months"
  | "3_6_months"
  | "6_12_months"
  | "12_plus_months"
  | "just_browsing"
  | "unknown";

export type ActivityType =
  | "call"
  | "text"
  | "email"
  | "note"
  | "meeting"
  | "showing"
  | "status_change"
  | "task_completed"
  | "system";

export type ActivityDirection = "inbound" | "outbound" | "none";

export type ActivitySource =
  | "manual"
  | "quo"
  | "gmail"
  | "calendly"
  | "eventbrite"
  | "jotform"
  | "checkin"
  | "house_hacking_site"
  | "site_form"
  | "listing_page"
  | "instagram"
  | "blinq"
  | "scheduling"
  | "granola"
  | "ai"
  | "system";

export type TaskPriority = "low" | "medium" | "high";

export type Representing = "buyer" | "seller" | "both";

export type PropertyType = "primary_residence" | "house_hack" | "investment" | "co_living" | "other";

export type DealSide = "buyer" | "seller";

export interface PipelineStage {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_closed_won: boolean;
  is_closed_lost: boolean;
  is_trash: boolean;
  is_under_contract: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TextTemplate {
  id: string;
  owner_id: string;
  label: string;
  body: string;
  is_default_draft: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContactFilterState {
  q?: string;
  stage?: string;
  tag?: string;
  tags?: string;
  type?: string;
  timeline?: string;
  representing?: string;
  phone?: string;
  sort?: string;
  kind?: string;
  lastTouch?: string;
  inList?: string;
  ids?: string;
  view?: string;
}

export interface ContactSegment {
  id: string;
  owner_id: string;
  name: string;
  filters: ContactFilterState;
  sort_order: number;
  created_at: string;
}

export type TextBlastStatus = "sending" | "completed" | "canceled";
export type TextBlastRecipientStatus = "pending" | "sent" | "failed" | "skipped";
export type TextBlastAttendanceStatus = "registered" | "attended" | "no_show" | "walk_in";

export interface TextBlast {
  id: string;
  owner_id: string;
  event_name: string;
  message: string;
  status: TextBlastStatus;
  created_at: string;
  completed_at: string | null;
  // Which specific occurrence + attendance slice this targeted - null on
  // blasts created before this existed, meaning "everyone ever registered
  // under this event name" (the original, still-supported behavior).
  event_id: string | null;
  attendance_status: TextBlastAttendanceStatus | null;
  // Set instead of event_id/attendance_status when this blast targeted a
  // tag's members directly rather than an event's registrants.
  tag_id: string | null;
  // "Send now anyway" at compose time - bypasses the 9:00 AM Eastern
  // quiet-hours hold the cron otherwise applies (see lib/crm/text-blasts.ts).
  send_immediately: boolean;
}

export interface TextBlastRecipient {
  id: string;
  blast_id: string;
  contact_id: string;
  status: TextBlastRecipientStatus;
  sent_at: string | null;
  error: string | null;
}

export interface Contact {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  contact_type: ContactType;
  representing: Representing | null;
  listing_address: string | null;
  listing_timeline: Timeline | null;
  stage_id: string | null;
  lead_source: string | null;
  budget_min: number | null;
  budget_max: number | null;
  areas_of_interest: string[];
  timeline: Timeline;
  next_follow_up_at: string | null;
  birthday: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  archived: boolean;
  last_event_name: string | null;
  last_event_at: string | null;
  ai_last_status_note: string | null;
  ai_last_analyzed_at: string | null;
  unsubscribe_token: string;
  quo_synced_at: string | null;
  quo_contact_id: string | null;
  dialer_contacted_at: string | null;
  dialer_snoozed_at: string | null;
  event_followup_contacted_at: string | null;
  event_followup_snoozed_at: string | null;
  referred_by: string | null;
  lease_ends_at: string | null;
  known_personally: boolean;
  // A spam-flagged call's auto-created contact - kept, not archived, so
  // the bucket has something to show and "Not spam" is recoverable.
  // Never mixed into archived's meaning; see migration 0066.
  spam: boolean;
  decision_maker: string | null;
  objection: string | null;
  consent_source: string | null;
  consent_at: string | null;
  opted_out_at: string | null;
  lead_date: string;
  recruit_stage: RecruitStage | null;
  referral_fee: number | null;
  recruit_joined_at: string | null;
  recruit_fee_received_at: string | null;
  tag_suggestions_backfilled_at: string | null;
  // Brokerage for a promoted agent ("Add to contacts as Referral
  // Partner") - see migration 0069. Nothing else on the contact writes
  // this; the Blinq integration still logs company/title as a timeline
  // note instead, since it predates this column.
  company: string | null;
  created_at: string;
  updated_at: string;
}

export type ListingStatus = "coming_soon" | "active" | "under_contract" | "archived";

// Public listings-index tag. Separate from `property_type` (free-text OM
// "PROPERTY TYPE" cell, e.g. "Legal duplex") and from deals.property_type
// (CRM enum). Do not infer this at render time from free text.
export type ListingPublicCategory = "coliving" | "airbnb" | "long_term_rental" | "primary_residence";

export type ListingPhotoSource = "manual" | "padsplit";

export interface Listing {
  id: string;
  owner_id: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  list_price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  public_category: ListingPublicCategory | null;
  mls_number: string | null;
  status: ListingStatus;
  story: string | null;
  zillow_url: string | null;
  photo_paths: string[];
  photo_source: ListingPhotoSource;
  hero_photo_url: string | null;
  padsplit_gallery: PadsplitPhoto[] | null;
  public_slug: string | null;
  padsplit_url: string | null;
  occupied_rooms: number | null;
  total_rooms: number | null;
  price_low: number | null;
  price_high: number | null;
  padsplit_photo_urls: string[] | null;
  last_scraped_at: string | null;
  last_scrape_error: string | null;
  // Offering-memorandum page fields - the address is never shown there, so
  // the page needs its own identity plus the fields the OM design surfaces.
  nickname: string | null;
  om_number: string | null;
  submarket: string | null;
  year_built: number | null;
  year_renovated: number | null;
  private_bathrooms: number | null;
  padsplit_since: string | null;
  parking: string | null;
  laundry: string | null;
  furnishings: string | null;
  public_description: string | null;
  band_gross_rent: string | null;
  band_expense_load: string | null;
  band_cash_on_cash: string | null;
  band_cap_rate: string | null;
  // Optional so a row read before migration 0084 still typechecks. Missing
  // or anything other than 'projected' is actual.
  data_basis_opex?: "actual" | "projected" | null;
  data_basis_opex_note?: string | null;
  financials: ListingFinancials | null;
  improvements: ListingImprovement[] | null;
  co_agent_name: string | null;
  co_agent_brokerage: string | null;
  co_agent_phone: string | null;
  co_agent_email: string | null;
  dd_days: number;
  seller_support_days: number;
  show_seller_section: boolean;
  padsplit_photos: PadsplitPhoto[] | null;
  excluded_photo_urls: string[];
  created_at: string;
  updated_at: string;
}

export type ListingFinancialsT12Line = { label: string; value: string; subtotal?: boolean };
export type ListingFinancialsScenario = {
  label: string;
  coc: string;
  cash_in: string;
  debt_service: string;
  cash_flow: string;
  dscr?: string;
  loan_amount?: string;
};

// Gated underwriting JSONB. Public OM never reads these exact figures
// until unlock; the locked page only shows the four band_* strings.
// Canonical gated $ rows are T12 monthly averages (Vera already ÷12):
// gross_rents, net_earnings, opex, noi, projected_debt_service, net_cash_flow.
// Ratios (cash_on_cash, cap_rate, dscr) render as cards. purchase_price stays
// on the object for CRM / Apply-to-OM but is not a gated row. Annual totals
// live on `annual` + the buyer workbook. Older aliases (platform_fees,
// padsplit_fees, t12, scenarios, net_cashflow) stay so Vera JSON can hydrate
// without new columns. Extra sidecar keys are preserved.
export type ListingFinancialsAnnual = {
  gross_rents?: string;
  net_earnings?: string;
  opex?: string;
  noi?: string;
  projected_debt_service?: string;
  net_cash_flow?: string;
  net_cashflow?: string;
};

export type ListingFinancials = {
  t12: ListingFinancialsT12Line[];
  noi: string;
  cap_rate: string;
  vacancy_pct?: string;
  occupancy_summary?: string;
  platform_fees?: string;
  padsplit_fees?: string;
  pm_fees?: string;
  expense_load_pct?: string;
  dscr?: string;
  purchase_price?: string;
  gross_rents?: string;
  net_earnings?: string;
  opex?: string;
  projected_debt_service?: string;
  net_cash_flow?: string;
  net_cashflow?: string;
  cash_on_cash?: string;
  annual?: ListingFinancialsAnnual;
  scenarios: ListingFinancialsScenario[];
  meta?: unknown;
  deal_key?: string;
  buyer_workbook_filename?: string;
  // Vera sidecar occupancy — public T12 chart SoT. Not gated underwriting.
  occupancy?: ListingOccupancy;
};

export type ListingOccupancyMonth = {
  month: string;
  days_in_month?: number;
  occupied_bed_nights?: number;
  available_bed_nights?: number;
  occupancy_pct: number;
  vacancy_pct?: number;
  in_flight?: boolean;
};

export type ListingOccupancy = {
  rooms?: number;
  basis?: string;
  t12_occupancy_pct?: number;
  monthly?: ListingOccupancyMonth[];
};

export type ListingDocumentType = "earnings_statement" | "t12" | "buyer_workbook";

export type ListingImprovement = { item: string; year: string; cost: string };

export type PadsplitPhoto = {
  url: string;
  category: string | null;
  alt?: string | null;
  title?: string | null;
  tags?: string[] | null;
};

export interface ListingOccupancySnapshot {
  id: string;
  listing_id: string;
  owner_id: string;
  occupied_rooms: number | null;
  total_rooms: number | null;
  captured_at: string;
}

export interface ListingDocument {
  id: string;
  listing_id: string;
  owner_id: string;
  doc_type: ListingDocumentType;
  storage_path: string;
  uploaded_at: string;
}

export interface ListingPriceChange {
  id: string;
  listing_id: string;
  owner_id: string;
  old_price: number | null;
  new_price: number;
  occurred_at: string;
}

export interface ListingStatusChange {
  id: string;
  listing_id: string;
  owner_id: string;
  old_status: ListingStatus | null;
  new_status: ListingStatus;
  occurred_at: string;
}

export type AgentSource = "fmls" | "gamls" | "manual";

// The cross-listing directory - every agent ever imported, deduped, plus
// ones added by hand. See migration 0069.
export interface Agent {
  id: string;
  owner_id: string;
  name: string;
  brokerage: string | null;
  email: string | null;
  phone: string | null;
  source: AgentSource;
  first_seen: string;
  last_emailed_at: string | null;
  opted_out_at: string | null;
  created_at: string;
}

export type ListingAgentState = "not_contacted" | "emailed" | "texted" | "replied" | "opted_out";

// One listing's reverse-prospecting row - never a contact, never in the
// pipeline, never in a metric. Keyed on (listing_id, ref_no).
export interface ListingAgent {
  id: string;
  listing_id: string;
  owner_id: string;
  agent_id: string | null;
  name: string;
  ref_no: string;
  brokerage: string | null;
  email: string | null;
  phone: string | null;
  count_sent: number | null;
  date_sent: string | null;
  state: ListingAgentState;
  replied_at: string | null;
  raw: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

export interface ListingAgentMessage {
  id: string;
  listing_id: string | null;
  listing_agent_id: string | null;
  agent_id: string | null;
  owner_id: string;
  direction: "inbound" | "outbound";
  channel: "text" | "email" | "call";
  body: string | null;
  occurred_at: string;
  quo_message_id: string | null;
  quo_call_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ListingSendStatus = "sending" | "completed" | "canceled";

export interface ListingSend {
  id: string;
  owner_id: string;
  listing_id: string;
  channel: "email" | "text";
  subject: string | null;
  message: string;
  audience?: string | null;
  status: ListingSendStatus;
  send_immediately: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface ListingSendRecipient {
  id: string;
  send_id: string;
  listing_agent_id: string;
  status: "pending" | "sent" | "failed" | "skipped";
  sent_at: string | null;
  error: string | null;
}

export interface DismissedInsight {
  id: string;
  owner_id: string;
  insight_key: string;
  contact_id: string | null;
  dismissed_at: string;
}

export type MeetingTranscriptSource = "quo" | "tactiq" | "granola" | "memo";
export type MeetingTranscriptStatus = "pending" | "ready" | "no_proposals" | "failed";

export type TranscriptParticipant = { name: string | null; email: string | null; isContact: boolean; contactId: string | null };

export interface MeetingTranscript {
  id: string;
  owner_id: string;
  contact_id: string | null;
  source: MeetingTranscriptSource;
  external_id: string;
  raw_payload: Record<string, unknown>;
  participants: TranscriptParticipant[];
  duration_seconds: number | null;
  occurred_at: string;
  status: MeetingTranscriptStatus;
  summary_bullets: string[];
  created_at: string;
}

export type ProposedField = "budget" | "timeline" | "areas_of_interest" | "decision_maker" | "objection" | "note" | "task" | "stage" | "showing" | "tag";
export type ProposedChangeStatus = "pending" | "accepted" | "rejected";

export interface ProposedChange {
  id: string;
  transcript_id: string;
  field: ProposedField;
  proposed_value: unknown;
  current_value: unknown;
  quote: string;
  timestamp_seconds: number | null;
  speaker: string | null;
  confidence: number;
  status: ProposedChangeStatus;
  created_at: string;
}

export interface WarmNotificationSettings {
  owner_id: string;
  rule_triple_open: boolean;
  rule_past_client_click: boolean;
  rule_hot_twice: boolean;
  rule_every_open: boolean;
  updated_at: string;
}

export interface GranolaMatchingSettings {
  owner_id: string;
  match_on_calendar_event: boolean;
  match_on_name_when_single: boolean;
  ask_when_ambiguous: boolean;
  updated_at: string;
}

export interface NoteNameMatch {
  id: string;
  owner_id: string;
  name_text: string;
  contact_id: string;
  created_at: string;
}

export interface PinnedTodayItem {
  id: string;
  owner_id: string;
  kind: "weekly_review" | "prep_sheet";
  payload: Record<string, unknown>;
  created_at: string;
  cleared_at: string | null;
}

export interface Activity {
  id: string;
  owner_id: string;
  contact_id: string;
  type: ActivityType;
  direction: ActivityDirection;
  body: string | null;
  occurred_at: string;
  source: ActivitySource;
  metadata: Record<string, unknown>;
  dedupe_field: string | null;
  dedupe_value: string | null;
  needs_reply: boolean | null;
  reply_reminder_sent_at: string | null;
  reply_dismissed_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  owner_id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  completed_at: string | null;
  priority: TaskPriority;
  created_at: string;
}

export interface ImportantDate {
  id: string;
  owner_id: string;
  contact_id: string;
  label: string;
  date: string;
  recurring: boolean;
  created_at: string;
}

export interface AiInsight {
  id: string;
  owner_id: string;
  contact_id: string;
  summary: string;
  suggested_action: string | null;
  suggested_stage_id: string | null;
  suggested_timeline: Timeline | null;
  suggested_tag_ids: string[] | null;
  confidence: number | null;
  dismissed: boolean;
  applied: boolean;
  created_at: string;
}

export type DealStatus = "pending" | "won";

// A row is created 'pending' the moment a contact enters an Under
// Contract stage (captured early, doesn't count as a real conversion
// yet), promoted in place to 'won' if they later enter a Win stage, or
// deleted if the contract falls through. A 'won' row is never touched
// again after that, so a repeat closer can cycle back to active without
// losing that they converted.
export interface Deal {
  id: string;
  owner_id: string;
  // Nullable so historical deals can be recorded without recreating a
  // full contact for each one - client_name carries a plain-text name
  // for the commission table when there's no linked contact to read it
  // from.
  contact_id: string | null;
  client_name: string | null;
  stage_id: string | null;
  status: DealStatus;
  closed_at: string;
  expected_closing_date: string | null;
  address: string | null;
  property_type: PropertyType | null;
  side: DealSide | null;
  sale_price: number | null;
  gross_commission: number | null;
  referral_pct: number | null;
  misc_fee: number;
  oz_fee: number;
  on_fmls: boolean;
  // When true, kw_fee/kwri_fee/fmls_fee/tc_fee/referral_fee below are used
  // as-is instead of being computed from the formula - for backfilling
  // historical deals with their real, already-known paid amounts rather
  // than a reconstruction that might not match old exceptions exactly.
  manual_split: boolean;
  kw_fee: number | null;
  kwri_fee: number | null;
  fmls_fee: number | null;
  tc_fee: number | null;
  referral_fee: number | null;
  lead_started_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ContactWithRelations extends Contact {
  pipeline_stages: PipelineStage | null;
  contact_tags: { tags: Tag }[];
}

export type MetricKey = "speed_to_lead" | "contacted_pct" | "follow_up_rate" | "conversion_rate" | "commission_goal";

export interface MetricGoal {
  id: string;
  owner_id: string;
  metric_key: MetricKey;
  target_value: number;
  created_at: string;
  updated_at: string;
}

export interface GmailAccount {
  id: string;
  owner_id: string;
  email_address: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  last_history_id: string | null;
  connected_at: string;
  updated_at: string;
}

export type SequenceType = "broadcast" | "drip" | "batch";
export type SequenceDelayUnit = "hours" | "days";
export type SequenceEnrollmentStatus = "active" | "paused" | "completed";

export interface EmailSequence {
  id: string;
  owner_id: string;
  name: string;
  type: SequenceType;
  target_tag_ids: string[]; // any of these tags = in the audience
  exclude_tag_ids: string[];
  exclude_stage_ids: string[];
  exclude_timelines: Timeline[];
  description: string | null;
  active: boolean;
  created_at: string;
  // Batch only: the exact contacts who matched target_tag_ids at creation
  // time, frozen so a one-off batch email never keeps picking up new
  // people tagged after the fact. Null for broadcast/drip, which stay
  // live off target_tag_ids.
  snapshot_contact_ids: string[] | null;
}

export interface EmailSequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  subject: string;
  body: string;
  send_at: string | null;
  delay_amount: number | null;
  delay_unit: SequenceDelayUnit | null;
  active: boolean;
  created_at: string;
}

export interface EmailSequenceEnrollment {
  id: string;
  sequence_id: string;
  contact_id: string;
  enrolled_at: string;
  current_step: number;
  status: SequenceEnrollmentStatus;
}

export interface EmailSequenceSend {
  id: string;
  sequence_id: string;
  step_id: string;
  contact_id: string;
  sent_at: string;
  opened_at: string | null;
  open_count: number;
  clicked_at: string | null;
  click_count: number;
  unsubscribed_at: string | null;
}

export interface EmailSequenceExclusion {
  id: string;
  sequence_id: string;
  contact_id: string;
  excluded_at: string;
}

export type LoanType = "fha_30" | "conventional_30" | "conventional_15";

export interface Quote {
  id: string;
  owner_id: string;
  contact_id: string | null;
  slug: string;
  client_first_name: string;
  property_address: string;
  property_description: string;
  purchase_price: number;
  down_payment_pct: number;
  interest_rate_pct: number;
  loan_type: LoanType;
  rent_from_other_unit: number | null;
  renting_now: number | null;
  taxes_annual: number;
  insurance_annual: number;
  loan_amount: number;
  monthly_principal_interest: number;
  monthly_taxes_insurance: number;
  monthly_mortgage_insurance: number;
  monthly_maintenance: number;
  monthly_out_of_pocket: number;
  cash_to_close: number;
  both_sides_rented_out_of_pocket: number | null;
  calc_version: number;
  created_at: string;
}

export interface InstagramMessage {
  id: string;
  owner_id: string;
  contact_id: string | null;
  ig_sender_id: string;
  ig_username: string | null;
  ig_name: string | null;
  ig_message_id: string;
  text: string;
  occurred_at: string;
  raw: Record<string, unknown>;
  created_at: string;
}

export interface InstagramContactLink {
  id: string;
  owner_id: string;
  ig_sender_id: string;
  contact_id: string;
  created_at: string;
}

export interface DailyRate {
  id: string;
  owner_id: string;
  rate_date: string;
  product: string;
  rate_pct: number;
  source: string;
  created_at: string;
}

export type EventConfirmationSource = "registered" | "manual";

export interface EventConfirmation {
  id: string;
  owner_id: string;
  event_id: string;
  event_name: string;
  contact_id: string;
  source: EventConfirmationSource;
  added_at: string;
  confirmed_at: string | null;
  snoozed_at: string | null;
}

export interface QuoteView {
  id: string;
  quote_id: string;
  visitor_key: string;
  viewed_at: string;
  user_agent: string | null;
}

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type WeeklyHours = Record<Weekday, { enabled: boolean; start: string; end: string }>;

export interface SchedulingSettings {
  owner_id: string;
  duration_minutes: number;
  days_out: number;
  visible_slot_pct: number;
  buffer_minutes: number;
  weekly_hours: WeeklyHours;
  updated_at: string;
}

// Every remaining row is contact-specific now - the generic /book
// address needs no link row at all (see app/book/page.tsx), only a
// personalized /book/{slug} link does, for the prefill.
export interface BookingLink {
  id: string;
  owner_id: string;
  contact_id: string;
  slug: string;
  created_at: string;
}

// A progressive session, not a one-shot submission: 'info' (name/phone
// given, no time picked yet - this is what makes an abandoned attempt
// visible to her) -> 'time_selected' (a slot picked, prep form not yet
// submitted) -> 'pending' (prep form submitted, ready for her review) ->
// 'approved' | 'declined' | 'canceled'.
export type BookingRequestStage = "info" | "time_selected" | "pending" | "time_proposed" | "approved" | "declined" | "canceled";

// Curated subset of ContactType a stranger can meaningfully self-select
// on the public booking form - excludes CRM-internal classifications
// (past_client, sphere, attendee) nobody outside the CRM would apply to
// themselves.
export type BookingContactType = "buyer" | "seller" | "both" | "investor" | "renter" | "referral_partner" | "vendor" | "other";

export interface BookingRequest {
  id: string;
  owner_id: string;
  booking_link_id: string | null;
  contact_id: string | null;
  visitor_name: string;
  visitor_phone: string;
  visitor_email: string | null;
  starts_at: string | null;
  ends_at: string | null;
  stage: BookingRequestStage;
  contact_type: BookingContactType | null;
  timeline: Timeline | null;
  questions: string | null;
  google_event_id: string | null;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  reminder_sent_at: string | null;
  abandonment_notified_at?: string | null;
  proposed_starts_at: string | null;
  proposed_ends_at: string | null;
  propose_token: string | null;
}

export interface EventRecord {
  id: string;
  owner_id: string;
  series: string;
  name: string;
  starts_at: string;
  ends_at: string;
  eventbrite_event_id: string | null;
  created_at: string;
}

