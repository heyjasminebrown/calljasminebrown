// "Worth asking today" - deterministic, not AI-generated. No new data:
// every question comes from whichever of these fields is null/empty on
// the contact snapshot the prep sheet already reads. Capped at 3 so a
// fully-filled-out contact doesn't get padded with generic filler.
export type QuestionInputs = {
  budgetMin: number | null;
  budgetMax: number | null;
  areasOfInterest: string[] | null;
  notes: string | null;
};

export function generateWorthAskingQuestions(inputs: QuestionInputs): string[] {
  const questions: string[] = [];

  if (!inputs.budgetMin && !inputs.budgetMax) questions.push("What's their actual budget ceiling?");
  if (!inputs.areasOfInterest || inputs.areasOfInterest.length === 0) questions.push("Which neighborhoods are they set on?");
  if (!inputs.notes) questions.push("Anything new since you last talked?");

  return questions.slice(0, 3);
}
