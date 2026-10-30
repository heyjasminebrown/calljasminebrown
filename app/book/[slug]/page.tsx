import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { OWNER_FIRST_NAME } from "@/lib/brand/identity";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Chat with ${OWNER_FIRST_NAME}`,
    description: "Pick a time that works for you.",
  };
}

export default async function BookSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BookingFlow slug={slug} />;
}
