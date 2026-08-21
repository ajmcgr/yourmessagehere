import { pad, useCountdown } from "@/hooks/useCountdown";

export function Countdown({
  target,
  size = "sm",
}: {
  target: Date;
  size?: "sm" | "lg";
}) {
  const r = useCountdown(target);
  const cls =
    size === "lg"
      ? "text-4xl md:text-6xl tracking-tight"
      : "text-sm tracking-tight";

  if (!r) {
    return <span className={`${cls} tabular-nums text-muted-foreground`}>--:--:--</span>;
  }

  return (
    <span className={`${cls} tabular-nums font-medium text-foreground`}>
      {r.days}d {pad(r.hours)}:{pad(r.minutes)}:{pad(r.seconds)}
    </span>
  );
}
