const TONES = {
  neutral: "bg-surface-muted border-border-control text-text-secondary",
  success: "bg-success-surface border-success text-success-ink",
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
      className={`rounded-booking inline-flex h-5 shrink-0 items-center border px-1.5 text-[11px] font-bold tracking-[0.02em] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
