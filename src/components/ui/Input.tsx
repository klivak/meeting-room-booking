type InputProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
  /** Extra content on the label line, such as a character counter. */
  labelSuffix?: React.ReactNode;
  /** Control drawn inside the right edge of the field, such as a reveal button. */
  trailing?: React.ReactNode;
};

// Text input with its label and field-level error message. The error lives next
// to the input because that is where the user is looking when it appears.
export function Input({
  label,
  error,
  labelSuffix,
  trailing,
  id,
  className,
  ...props
}: InputProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-baseline gap-2">
        <label htmlFor={id} className="text-text-secondary text-[12.5px] font-bold">
          {label}
        </label>
        {labelSuffix ? <span className="ml-auto">{labelSuffix}</span> : null}
      </span>
      {/* The wrapper exists so a trailing control can sit inside the field; with
          no trailing control it is an ordinary block and changes nothing. */}
      <span className="relative flex">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          // The focus and error states are a 1.5px edge plus a soft ring of the
          // same colour: at an 11px radius a plain 2px border reads as a jump in
          // weight, the ring reads as the field lighting up.
          className={`bg-surface text-text-primary rounded-control min-h-11 w-full border px-3.5 text-sm transition outline-none sm:min-h-11 ${
            trailing ? "pr-12" : ""
          } ${
            error
              ? "border-danger border-[1.5px] shadow-[0_0_0_3px_var(--color-danger-surface)]"
              : "border-border-grid hover:border-border-control focus-visible:border-accent-own-booking focus-visible:border-[1.5px] focus-visible:shadow-[0_0_0_3px_var(--color-accent-own-surface)]"
          } ${className ?? ""}`}
          {...props}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </span>
        ) : null}
      </span>
      {error ? (
        <p id={errorId} className="text-danger-ink text-xs leading-snug font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
