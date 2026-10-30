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
  return <BookingFlow slug={null} fixture={fixture} />;
}
