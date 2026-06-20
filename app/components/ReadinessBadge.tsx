import { READINESS_CONFIG, type ReadinessStatus } from "../lib/identityReadiness";

interface ReadinessBadgeProps {
  status: ReadinessStatus;
  score?: number;
  /** "dot" shows only a colored dot (for tight spaces), "chip" shows label text */
  variant?: "chip" | "dot";
  className?: string;
}

export function ReadinessBadge({ status, score, variant = "chip", className = "" }: ReadinessBadgeProps) {
  const cfg = READINESS_CONFIG[status];
  if (variant === "dot") {
    return (
      <span
        title={`${cfg.label}${score !== undefined ? ` (${score}/100)` : ""}`}
        className={`inline-block size-2 rounded-full ${cfg.bgClass.replace("/15", "/80")} ring-1 ring-black/10 ${className}`}
        style={{ backgroundColor: cfg.color }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 border rounded-full text-[10px] font-medium px-1.5 py-0.5 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ${className}`}
    >
      {cfg.label}
      {score !== undefined && <span className="opacity-70">· {score}</span>}
    </span>
  );
}
