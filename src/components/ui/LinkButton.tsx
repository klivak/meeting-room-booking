import Link from "next/link";

// A link that looks like a button. Kept next to Button so both share one shape,
// one spacing scale and one focus ring; navigation stays a real link, which
// keeps middle-click and "open in new tab" working.

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary";
  active?: boolean;
};

export function LinkButton({
  variant = "secondary",
  active = false,
  className,
  ...props
}: LinkButtonProps) {
  const style =
    active || variant === "primary"
      ? "accent-gradient shadow-accent border-transparent text-white hover:brightness-[1.06]"
      : "border-border-grid bg-surface-muted text-text-secondary hover:border-border-control hover:text-text-primary";

  return (
    <Link
      aria-current={active ? "page" : undefined}
      // Matches Button: a finger-sized target on a phone, compact on a desktop.
      className={`focus-ring rounded-control inline-flex min-h-11 items-center justify-center gap-[7px] border px-4 text-[13px] font-bold no-underline transition active:scale-[0.985] sm:min-h-[38px] ${style} ${
        className ?? ""
      }`}
      {...props}
    />
  );
}
