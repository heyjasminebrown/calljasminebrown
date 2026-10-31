"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListTodo } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { taskDueLabel } from "@/lib/crm/today-v1";
import { TODAY_CARD } from "@/components/dashboard/today-home-layout";
import { cn } from "@/lib/utils";
import type { WorklistTask } from "@/lib/data/today";

export function TodayTodosCard({ tasks }: { tasks: WorklistTask[] }) {
  const router = useRouter();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const visibleTasks = tasks.filter((task) => !doneIds.has(task.id));
  const empty = visibleTasks.length === 0;

  async function toggleComplete(task: WorklistTask) {
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", task.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDoneIds((prev) => new Set(prev).add(task.id));
    router.refresh();
  }

  return (
    <section data-today-home="todos" className={cn("overflow-hidden", TODAY_CARD)}>
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-5">
        <ListTodo size={16} strokeWidth={1.7} className="text-[#34223a]" />
        <h2 className="text-[15px] font-semibold text-neutral-900">To Dos</h2>
      </div>
      {error && <p className="px-5 pt-2 text-[13px] text-red-600">{error}</p>}
      {empty ? (
        <p className="px-4 py-5 text-[14px] text-neutral-400 sm:px-5">Nothing on the list right now.</p>
      ) : (
        <ul className="mt-1">
          {visibleTasks.map((task, i) => {
            const due = taskDueLabel(task.dueAt);
            return (
              <li
                key={task.id}
                className={cn("flex items-center gap-3 px-4 py-3.5 sm:px-5", i > 0 && "border-t border-[#ddd7da]/80")}
              >
                <button
                  type="button"
                  onClick={() => void toggleComplete(task)}
                  aria-label={`Complete ${task.title}`}
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-neutral-300 bg-white"
                >
                  <Check size={12} className="opacity-0" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-neutral-800">{task.title}</p>
                </div>
                {due && <span className="shrink-0 text-[13px] font-medium text-[#34223a]">{due === "Today" ? "Due today" : due}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
