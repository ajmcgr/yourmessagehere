import { pad, useCountdown } from "@/hooks/useCountdown";

export function Countdown({
  target,
  size = "sm",
  suffix = " left",
}: {
  target: Date;
  size?: "sm" | "lg";
  suffix?: string;
}) {
  const r = useCountdown(target);
  const cls =
    size === "lg"
      ? "text-4xl md:text-6xl tracking-tight"
      : "text-sm tracking-tight";

  if (!r) {
    return <span className={`${cls} tabular-nums text-muted-foreground`}>--:--:--{suffix}</span>;
  }

  const clock = `${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`;

  return (
    <span className={`${cls} tabular-nums font-medium text-foreground`}>
      {r.days > 0 ? `${r.days}d ${clock}` : clock}
      {suffix}
    </span>
  );
}
