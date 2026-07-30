type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

// The primary action is the only one that leaves the surface: it carries a
// resting shadow and lifts on hover. Everything else stays flat, so a screen
// with five controls still has exactly one obvious next step.
const VARIANTS = {
  primary:
    "border-transparent bg-accent-own-booking text-accent-own-on shadow-rest hover:shadow-panel",
  // The default for anything that is not the main action of its group.
  secondary:
    "border-border-control bg-surface text-text-primary hover:bg-surface-muted",
  ghost: "border-transparent text-text-secondary hover:bg-surface-muted",
  // Outlined, so a destructive action never looks like the routine one. The
  // filled version exists only inside the confirmation dialog, where the user
  // has already said what they are about to do.
  danger:
    "border-danger bg-transparent text-danger-ink hover:bg-danger-surface",
  dangerSolid:
    "border-transparent bg-danger text-white shadow-rest hover:shadow-panel",
};

// One height on a phone (44px, roughly what a finger needs) and a compact one
// from the sm breakpoint up, where the pointer is precise.
const SIZES = {
  sm: "min-h-11 px-3 text-[13px] sm:min-h-8",
  md: "min-h-11 px-4 text-[13px] sm:min-h-[38px]",
  // The main action of a mobile sheet, which is the widest target on that screen.
  lg: "min-h-12 px-4 text-sm",
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
      // shrinks the button instead of nudging it down: at a 10px radius a
      // translate reads as a wobble, a scale reads as a press.
      className={`focus-ring rounded-control inline-flex min-w-[96px] items-center justify-center gap-[7px] border font-semibold transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-[0.45] ${
        SIZES[size]
      } ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
