type Step = "info" | "time" | "details" | "done";

const STEPS = [
  { n: "1", label: "Your info" },
  { n: "2", label: "Pick a time" },
  { n: "3", label: "Details" },
];

export function BookingSteps({ step }: { step: Step }) {
  const current = step === "done" ? 3 : step === "info" ? 1 : step === "time" ? 2 : 3;
  return (
    <div className="bk-steps" aria-label={`Step ${current} of 3`}>
      {STEPS.map((item, index) => {
        const n = index + 1;
        const state = n < current ? "done" : n === current ? "on" : "";
        return (
          <div key={item.label} className={state}>
            <b>{item.n}</b>
            {item.label}
          </div>
        );
      })}
    </div>
  );
}
