import { COUNT_SCOPE, COUNT_SCOPE_DISAGREE, COUNT_SCOPE_LABEL, type CountScopeId } from "@/lib/crm/count-scopes";

export function CountScopeNote({ current }: { current: CountScopeId }) {
  return (
    <p data-count-scope={current} className="mt-1.5 max-w-2xl text-[13px] leading-5 text-neutral-500">
      <span className="font-medium text-neutral-700">{COUNT_SCOPE_LABEL[current]}. </span>
      {COUNT_SCOPE[current]}{" "}
      <span className="text-neutral-400">{COUNT_SCOPE_DISAGREE}</span>
    </p>
  );
}
