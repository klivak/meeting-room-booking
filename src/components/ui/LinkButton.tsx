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
      ? "border-accent-own-booking bg-accent-own-booking text-accent-own-on hover:brightness-110"
      : "border-border-control bg-surface text-text-secondary hover:text-text-primary";

  return (
    <Link
      aria-current={active ? "page" : undefined}
      // Matches Button: a finger-sized target on a phone, compact on a desktop.
      className={`focus-ring inline-flex min-h-11 items-center justify-center rounded-control border px-4 text-[13px] font-semibold no-underline transition active:translate-y-px sm:min-h-[38px] ${style} ${
        className ?? ""
      }`}
      {...props}
    />
  );
}
