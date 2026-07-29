type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

const VARIANTS = {
  primary:
    "border border-accent-own-booking bg-accent-own-booking text-accent-own-on hover:brightness-110",
  // The default for anything that is not the main action of its group.
  secondary:
    "border border-border-control bg-surface text-text-secondary hover:text-text-primary",
  ghost: "border border-transparent text-text-secondary hover:bg-surface-muted",
  // Outlined, so a destructive action never looks like the routine one. The
  // filled version exists only inside the confirmation dialog, where the user
  // has already said what they are about to do.
  danger:
    "border border-danger bg-transparent text-danger-ink hover:bg-danger-surface",
  dangerSolid: "border border-danger bg-danger text-white hover:brightness-110",
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
      // label gets short in English ("Book" against "Забронювати").
      className={`focus-ring inline-flex min-w-[88px] items-center justify-center rounded-control font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-[0.55] ${
        SIZES[size]
      } ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
