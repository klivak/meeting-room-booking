import Link from "next/link";

// A link that looks like a button. Kept next to Button so both share one shape,
// one spacing scale and one focus ring; navigation stays a real link, which
// keeps middle-click and "open in new tab" working.

type LinkButtonProps = React.ComponentProps<typeof Link> & {
  variant?: "primary" | "ghost";
  active?: boolean;
};

export function LinkButton({
  variant = "ghost",
  active = false,
  className,
  ...props
}: LinkButtonProps) {
  const style =
    active || variant === "primary"
      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
      : "border-slate-300 text-slate-700 hover:bg-slate-100";

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`rounded-lg border px-4 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none ${style} ${
        className ?? ""
      }`}
      {...props}
    />
  );
}
