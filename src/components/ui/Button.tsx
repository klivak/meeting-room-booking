type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

// The primary action is the only one that leaves the surface: a jade gradient
// with a glow of its own colour under it. Everything else stays flat, so a
// screen with five controls still has exactly one obvious next step.
const VARIANTS = {
  primary:
    "accent-gradient shadow-accent border-transparent text-white hover:brightness-[1.06]",
  // The default for anything that is not the main action of its group.
  secondary:
    "border-border-grid bg-surface-muted text-text-secondary hover:border-border-control hover:text-text-primary",
  ghost: "border-transparent text-text-secondary hover:bg-surface-muted",
  // Tinted rather than filled, so a destructive action never looks like the
  // routine one. The filled version exists only inside the confirmation dialog,
  // where the user has already said what they are about to do.
  danger:
    "border-danger-border bg-danger-surface text-danger-ink hover:brightness-[0.97]",
  dangerSolid:
    "bg-danger-solid border-transparent text-white shadow-[0_8px_20px_-8px_var(--color-danger-border)] hover:brightness-[1.06]",
};

// One height on a phone (44px, roughly what a finger needs) and a compact one
// from the sm breakpoint up, where the pointer is precise.
const SIZES = {
  sm: "min-h-11 px-3.5 text-[13px] sm:min-h-8",
  md: "min-h-11 px-4 text-[13px] sm:min-h-[38px]",
  // The main action of a mobile sheet, which is the widest target on that screen.
  lg: "min-h-12 px-5 text-sm sm:min-h-11",
};

export function Button({
  variant = "primary",
  size = "md",
  // A bare <button> inside a form submits it. That is almost never what a
  // button here means — "Скасувати бронювання" sits inside the booking form and
  // must open its dialog, not save the form — so submitting is opt-in.
  type = "button",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      // The minimum width keeps a button from shrinking to its text when the
      // label gets short in English ("Book" against "Забронювати"). Pressing
      // shrinks the button instead of nudging it down: at an 11px radius a
      // translate reads as a wobble, a scale reads as a press.
      className={`focus-ring rounded-control inline-flex min-w-[96px] items-center justify-center gap-[7px] border font-bold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-[0.45] disabled:shadow-none ${
        SIZES[size]
      } ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
