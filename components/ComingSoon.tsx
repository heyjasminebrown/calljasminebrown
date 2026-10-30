import { Card } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

// Phase 2+ nav destinations get a real route now (not a 404) so the new
// thirteen-item nav is honest about what exists, without pretending these
// screens are built - see the redesign handoff's "New destinations" list.
export function ComingSoon({ title, description, icon: Icon }: { title: string; description: string; icon: LucideIcon }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-serif text-2xl font-semibold text-neutral-900">{title}</h1>
      <Card className="mt-5 flex flex-col items-center gap-3 py-14 text-center">
        <Icon size={28} className="text-neutral-400" />
        <p className="max-w-sm text-[15px] leading-6 text-neutral-500">{description}</p>
      </Card>
    </div>
  );
}
