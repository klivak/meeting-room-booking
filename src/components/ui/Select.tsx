import { ChevronDown } from "lucide-react";

// One look for the panel's selects and the date field; they differ only in what
// they hold. The focus state is a 1.5px edge plus a soft ring of the same
// colour, so a focused field reads as lit rather than as suddenly heavier.
export const CONTROL_CLASS =
  "border-border-grid bg-surface text-text-primary rounded-control min-h-11 min-w-0 border px-2.5 text-sm font-semibold transition outline-none hover:border-border-control focus-visible:border-accent-own-booking focus-visible:border-[1.5px] focus-visible:shadow-[0_0_0_3px_var(--color-accent-own-surface)] sm:min-h-10";

// A real <select> with the system arrow hidden and our own drawn over it. The
// element itself stays native, so a phone still opens its built-in picker and
// keyboard and screen-reader behaviour need no code of ours.
export function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <span className="relative flex min-w-0">
      <select
        className={`${CONTROL_CLASS} peer w-full appearance-none pe-8 ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="text-text-tertiary pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 transition peer-hover:text-text-secondary peer-disabled:opacity-[0.45]"
      />
    </span>
  );
}
