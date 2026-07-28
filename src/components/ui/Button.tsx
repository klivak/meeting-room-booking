type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "ghost" | "danger";
};

const VARIANTS = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  ghost: "border border-slate-300 text-slate-700 hover:bg-slate-100",
  // Used only for actions that destroy something, so they never look routine.
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        VARIANTS[variant]
      } ${className ?? ""}`}
      {...props}
    />
  );
}
