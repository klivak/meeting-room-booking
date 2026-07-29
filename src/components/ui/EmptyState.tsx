// Shown when a list has nothing in it. The dashed border says "this frame is
// real, it is simply empty" — a solid card reads as content that failed to
// arrive. Always states why it is empty and offers the next step.
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
    <div className="border-border-control bg-surface rounded-card flex flex-col items-start gap-2 border border-dashed p-6">
      <p className="text-text-primary text-[15px] font-semibold">{title}</p>
      {description ? (
        <p className="text-text-secondary max-w-[36ch] text-[13px] leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
