import { redirect } from "next/navigation";

// Text sends now live in the same unified list as emails - see
// app/(app)/sequences/page.tsx's CampaignsList. Kept as a redirect so any
// existing bookmark/link to this route still lands somewhere useful.
export default function TextBlastsRedirect() {
  redirect("/sequences");
}
