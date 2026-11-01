"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEAD_SOURCES } from "@/lib/utils";

// Lead source is free text: typing a new one on any contact "adds" it.
// Suggestions are the standard list plus every source already used on a
// contact, so a new one shows up everywhere from then on.
export function useLeadSourceOptions(): string[] {
  const [options, setOptions] = useState<string[]>(LEAD_SOURCES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const used = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("contacts").select("lead_source").not("lead_source", "is", null).range(from, from + 999);
        if (error || !data) break;
        for (const row of data) if (row.lead_source?.trim()) used.add(row.lead_source.trim());
        if (data.length < 1000) break;
      }
      const standard = new Set(LEAD_SOURCES.map((s) => s.toLowerCase()));
      const custom = [...used].filter((s) => !standard.has(s.toLowerCase())).sort((a, b) => a.localeCompare(b));
      if (!cancelled) setOptions([...LEAD_SOURCES, ...custom]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}
