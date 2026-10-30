import { cn, initials } from "@/lib/utils";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
  }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
      size === "sm" && "px-3 py-1.5 text-sm",
      size === "md" && "px-4 py-2.5 text-sm",
      size === "lg" && "px-5 py-3.5 text-base",
      variant === "primary" && "bg-brand-600 text-white hover:bg-brand-700",
      variant === "secondary" && "bg-white text-neutral-800 border border-neutral-200 hover:bg-neutral-50",
      variant === "ghost" && "text-neutral-700 hover:bg-neutral-100",
      variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100",
      className,
    )}
    {...props}
  />
));
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        // min-w-0 overrides the browser default of never shrinking a <select>
        // below its widest option's intrinsic content width - without it, one
        // long option (an event name, a stage name) can force the select past
        // its own w-full box and push the whole page into horizontal scroll,
        // especially inside a flex row where min-width:auto wins by default.
        "w-full min-w-0 truncate rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-base text-neutral-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-neutral-700", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[#eadfd6] bg-[#fffbf8] p-4 shadow-card", className)} {...props} />;
}

// No colour as decoration (Phase 1 rule) - plain stone, same treatment
// every other avatar in the app (contact detail header, etc.) already uses.
export function Avatar({
  firstName,
  lastName,
  size = 44,
  className,
}: {
  id?: string;
  firstName: string;
  lastName?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold text-neutral-600", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}

export function Badge({
  className,
  color,
  children,
}: {
  className?: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", className)}
      style={
        color
          ? { backgroundColor: `${color}1a`, color }
          : undefined
      }
    >
      {children}
    </span>
  );
}
