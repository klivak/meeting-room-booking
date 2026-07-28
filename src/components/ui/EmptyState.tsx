// Shown when a list has nothing in it. Always says what is missing and, where
// there is something useful to do next, offers it.
export function EmptyState({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-sm text-slate-600">{title}</p>
      {action}
    </div>
  );
}
