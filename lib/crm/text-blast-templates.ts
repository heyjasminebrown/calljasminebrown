// Pure string logic, no imports - same style as new-lead-text-templates.ts.
//
// Generic bulk-text template categories for the Text blast composer
// (TextBlastModal) and the dialer's quick-pick chips (PersonCard). The
// original app's version of this file (lib/crm/event-text-templates.ts)
// was entirely meetup-event-specific copy hardcoded with the original
// owner's name and group names - intentionally replaced here, not kept
// (see README). EDIT THE COPY BELOW for your own business; the
// `build(account, eventName)` signature is kept only so existing callers
// (built around an optional "which event/account is this about" context)
// don't need to change - a generic template is free to ignore both args.

import { OWNER_NAME } from "@/lib/brand/identity";

export function eventGroupLabel(_account: string | null | undefined, eventName: string | null | undefined): string {
  return eventName || "that";
}

export function organizerRole(_account: string | null | undefined, _eventName: string | null | undefined): string {
  return "with";
}

export type MessageTemplateOption = { label: string; build: (account: string | null | undefined, eventName: string | null | undefined) => string };
export type MessageTemplateCategory = { key: "registration" | "pre_event" | "follow_up"; label: string; options: MessageTemplateOption[] };

const FOLLOW_UP_OPENER = `Hi {{first_name}}! Thanks so much for the time today - great talking with you.`;

// Bulk-blast templates, grouped into three moments most relationship-driven
// businesses send texts around. Shown behind one button per category in the
// composer. Every option contains the literal {{first_name}} token (not a
// real name), substituted once per recipient by applyMergeFields during the
// actual staggered send.
export const MESSAGE_TEMPLATE_CATEGORIES: MessageTemplateCategory[] = [
  {
    key: "registration",
    label: "Welcome",
    options: [
      {
        label: "Welcome (new contact)",
        build: () => `Hi {{first_name}}, this is ${OWNER_NAME}. Just wanted to introduce myself! Any questions I can answer for you? 🙂`,
      },
      {
        label: "Welcome back (returning)",
        build: () => `Hey {{first_name}}, this is ${OWNER_NAME} - good to hear from you again! Any questions I can answer? 🙂`,
      },
    ],
  },
  {
    key: "pre_event",
    label: "Reminder",
    options: [
      {
        label: "Week before",
        build: () => `Hi {{first_name}}, this is ${OWNER_NAME} - just confirming we're still on for next week. Does the time still work for you?`,
      },
      {
        label: "Few days before",
        build: () => `Hi {{first_name}}, this is ${OWNER_NAME} - looking forward to connecting in a few days. Let me know if anything's changed on your end.`,
      },
      {
        label: "Day before",
        build: () => `Hi {{first_name}}! Quick reminder we're set for tomorrow. Just a simple yes or no would be very helpful - thank you! 😊\n- ${OWNER_NAME}`,
      },
      {
        label: "Day of",
        build: () => `Hi {{first_name}}, this is ${OWNER_NAME} - quick reminder we're set for today. Can't wait to connect. 🙂`,
      },
    ],
  },
  {
    key: "follow_up",
    label: "Follow-up",
    // Every option shares this opener, then ends in a genuine question
    // rather than a statement - the goal is a reply, not just an
    // impression, so a recipient can respond in one line without it
    // feeling like reading a broadcast.
    options: [
      { label: "Ask their takeaway", build: () => `${FOLLOW_UP_OPENER} What stood out most to you? Would love to hear.` },
      { label: "Ask where they're at", build: () => `${FOLLOW_UP_OPENER} Where are things at on your end right now - early days, or ready to move?` },
      { label: "Offer to help", build: () => `${FOLLOW_UP_OPENER} Anything I can help you with from here? Happy to chat more any time 🤩` },
    ],
  },
];
