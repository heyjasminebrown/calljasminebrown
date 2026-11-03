import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { OWNER_NAME } from "@/lib/brand/identity";

export const metadata: Metadata = {
  title: `Book a Meeting with ${OWNER_NAME}`,
  description: `Pick a time that works for you to talk with ${OWNER_NAME}.`,
};

export default async function BookPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = searchParams ? await searchParams : {};
  const fixture = typeof raw.fixture === "string" ? raw.fixture : null;
  // ?calendar=<link> opens one booking calendar; ?embed=1 is how
  // heyjasminebrown.com/meet shows this page inside its own layout.
  const calendar = typeof raw.calendar === "string" ? raw.calendar.toLowerCase() : null;
  const embed = raw.embed === "1";
  return <BookingFlow slug={null} calendarSlug={calendar} embed={embed} fixture={fixture} />;
}
