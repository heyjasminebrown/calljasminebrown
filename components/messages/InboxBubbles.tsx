import { inboxRelativeTime } from "@/lib/crm/messages-v1";
import { cn } from "@/lib/utils";
import type { SmsThreadMessage } from "@/lib/crm/messages-v1";

export function InboxBubbles({ messages }: { messages: SmsThreadMessage[] }) {
  if (messages.length === 0) {
    return <p className="py-16 text-center text-sm text-neutral-400">No SMS in this thread yet.</p>;
  }

  return (
    <div className="space-y-5">
      {messages.map((message) => {
        const outbound = message.direction === "outbound";
        return (
          <div key={message.id} className={cn("flex min-w-0", outbound ? "justify-end" : "justify-start")}>
            <div className={cn("min-w-0 max-w-[78%]", outbound ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-[18px] px-4 py-3 text-[15px] leading-6 text-neutral-900",
                  outbound ? "bg-[#F3E4DC]" : "border border-[#eadfd6] bg-white",
                )}
              >
                {message.body}
              </div>
              <p className={cn("mt-1.5 text-[12px] text-neutral-400", outbound ? "text-right" : "text-left")}>
                {inboxRelativeTime(message.occurredAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
