export const INFERFORM_BYLINE = "A product of Inferaform";

type LeadflowBrandProps = {
  size?: "sm" | "md" | "lg";
  showByline?: boolean;
  byline?: string;
  className?: string;
  /** "light" renders white wordmark + a brighter byline for dark panels (e.g. the login hero). */
  tone?: "ink" | "light";
};

const markSizes = {
  sm: 24,
  md: 28,
  lg: 36,
} as const;

const titleSizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-4xl",
} as const;

export function LeadflowBrand({
  size = "md",
  showByline = false,
  byline = INFERFORM_BYLINE,
  className = "",
  tone = "ink",
}: LeadflowBrandProps) {
  const mark = markSizes[size];
  const titleColor = tone === "light" ? "text-white" : "text-[var(--ink)]";
  const bylineColor =
    tone === "light"
      ? "text-[#5eead4]"
      : size === "lg"
        ? "text-[var(--signal)]"
        : "text-[var(--muted)]";

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {tone === "light" ? (
        <span
          className="inline-flex shrink-0 items-center justify-center rounded-[9px] bg-white/95 shadow-[0_2px_10px_rgba(0,0,0,0.18)]"
          style={{ width: mark + 10, height: mark + 10 }}
        >
          <img src="/leadflow-mark.svg" alt="" width={mark} height={mark} aria-hidden />
        </span>
      ) : (
        <img
          src="/leadflow-mark.svg"
          alt=""
          width={mark}
          height={mark}
          className="shrink-0"
          aria-hidden
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`lf-display font-semibold leading-none ${titleColor} ${titleSizes[size]}`}>
          Leadflow
        </span>
        {showByline ? (
          <span
            className={
              size === "lg"
                ? `text-xs font-semibold uppercase tracking-[0.14em] ${bylineColor}`
                : `text-[0.68rem] font-semibold uppercase tracking-[0.06em] ${bylineColor}`
            }
          >
            {byline}
          </span>
        ) : null}
      </span>
    </span>
  );
}
