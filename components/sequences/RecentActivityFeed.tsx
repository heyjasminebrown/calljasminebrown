import { Card } from "@/components/ui";
import { formatLocal } from "@/lib/format-time";
import { fullName } from "@/lib/utils";
import { Mail, Eye, MousePointerClick, UserX } from "lucide-react";
import type { ComponentType } from "react";
import type { SequenceActivityItem } from "@/lib/data/sequences";

const KIND_META: Record<SequenceActivityItem["kind"], { icon: ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
  sent: { icon: Mail, label: "was sent", color: "text-neutral-400" },
  opened: { icon: Eye, label: "opened", color: "text-brand-600" },
  clicked: { icon: MousePointerClick, label: "clicked a link in", color: "text-emerald-600" },
  unsubscribed: { icon: UserX, label: "unsubscribed after", color: "text-red-600" },
};

export function RecentActivityFeed({ items }: { items: SequenceActivityItem[] }) {
  if (items.length === 0) {
    return <Card className="text-sm text-neutral-500">No activity yet.</Card>;
  }
  return (
    <Card className="divide-y divide-neutral-100 p-0">
      {items.map((item) => {
        const meta = KIND_META[item.kind];
        const Icon = meta.icon;
        return (
          <div key={item.id} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
            <Icon size={15} className={`mt-0.5 shrink-0 ${meta.color}`} />
            <p className="text-neutral-600">
              <span className="font-medium text-neutral-900">{item.contact ? fullName(item.contact) : "Someone"}</span> {meta.label}{" "}
              &ldquo;{item.stepSubject}&rdquo;
              <span className="ml-1.5 text-xs text-neutral-400">{formatLocal(item.at, "MMM d, h:mm a")}</span>
            </p>
          </div>
        );
      })}
    </Card>
  );
}
