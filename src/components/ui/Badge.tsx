const TONES = {
  neutral: "bg-surface-muted border-border-grid text-text-secondary",
  success: "bg-success-surface border-transparent text-success-ink",
  warning: "bg-warning-surface border-warning-border text-warning-ink",
};

// Every badge carries a border and a word, never colour alone: at 11px a fill
// is not enough to tell "зараз" from "щотижня" in grayscale.
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`rounded-chip inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-[3px] text-[11px] font-bold tracking-[0.01em] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
