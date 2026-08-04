type IconButtonProps = React.ComponentProps<"button"> & {
  /** Spoken name of the control; it has no visible text of its own. */
  label: string;
  /** Pressed/open controls keep the hover fill so the state is visible at rest. */
  active?: boolean;
};

/**
 * The square control the header is built from: language, theme, bell, menu. It
 * is 44px on a phone, where a finger has to hit it, and 36px from sm up, where
 * a pointer does — the design's one icon-button size.
 */
export function IconButton({
  label,
  active,
  type = "button",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`focus-ring border-border-grid text-text-secondary hover:text-text-primary hover:border-border-control rounded-chip relative flex h-11 w-11 shrink-0 items-center justify-center border transition sm:h-9 sm:w-9 ${
        active ? "bg-surface-raised text-text-primary" : "bg-surface-muted"
      } ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
