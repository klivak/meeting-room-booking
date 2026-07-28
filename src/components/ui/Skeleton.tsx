// Placeholder block shown while data loads. A skeleton rather than a spinner,
// so the layout does not jump once the content arrives.
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`skeleton rounded-lg ${className ?? ""}`}
      style={style}
    />
  );
}
