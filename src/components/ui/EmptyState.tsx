import { SlotMotif } from "@/components/ui/SlotMotif";

// Shown when a list has nothing in it. The picture is three slots from the grid
// itself, because an empty week is an opportunity rather than a failure and a
// crossed-out magnifier says the opposite. Always states why it is empty and
// offers the next step.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border-grid bg-surface rounded-card shadow-card relative flex flex-col items-center gap-3 overflow-hidden border p-10 text-center">
      {/* The row rhythm of the grid, faded: the frame is real, it is simply
          empty. */}
      <span
        aria-hidden="true"
        className="grid-rows-day pointer-events-none absolute inset-0 opacity-70"
      />
      <SlotMotif className="relative mb-1" />
      <p className="relative text-xl font-extrabold tracking-[-0.02em]">{title}</p>
      {description ? (
        <p className="text-text-secondary relative max-w-[38ch] text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="relative mt-2">{action}</div> : null}
    </div>
  );
}
