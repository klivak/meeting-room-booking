type InputProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
};

// Text input with its label and field-level error message. The error lives next
// to the input because that is where the user is looking when it appears.
export function Input({ label, error, id, className, ...props }: InputProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`min-h-11 rounded-lg border px-3 py-2 text-slate-900 outline-none transition sm:min-h-0 focus:ring-2 ${
          error
            ? "border-red-400 focus:ring-red-200"
            : "border-slate-300 focus:border-slate-400 focus:ring-slate-200"
        } ${className ?? ""}`}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
