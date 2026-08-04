// Placeholder block shown while data loads. A skeleton rather than a spinner,
// and always in the shape of the real content, so nothing jumps once it arrives.
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton rounded-booking ${className ?? ""}`} style={style} />;
}
