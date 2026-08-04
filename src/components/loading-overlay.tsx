"use client";

type LoadingOverlayProps = {
  /** Announced to screen readers and shown as small text under the spinner. */
  label?: string;
  /** Use `fixed` positioning to cover the whole viewport (route-level loads) instead of the nearest `position: relative` ancestor. */
  fixed?: boolean;
  /** Hide the visible label text but keep it for screen readers. */
  labelHidden?: boolean;
  className?: string;
};

/**
 * Shared "content is loading" treatment: a blurred scrim over whatever's
 * behind it plus a centered ring spinner, so every busy state reads the same
 * way instead of each page inventing its own "Loading…" paragraph.
 *
 * Renders `absolute inset-0` by default — the caller must give the nearest
 * ancestor `position: relative` (and usually a min-height) so the overlay has
 * something to cover. Pass `fixed` for whole-viewport loads (route
 * transitions, initial session fetches) where no relative ancestor is set up.
 */
export function LoadingOverlay({ label = "Loading…", fixed = false, labelHidden = false, className = "" }: LoadingOverlayProps) {
  return (
    <div
      className={`lf-loading-overlay${fixed ? " lf-loading-overlay--fixed" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="lf-loading-ring" aria-hidden="true" />
      <span className={labelHidden ? "lf-sr-only" : "lf-loading-label"}>{label}</span>
    </div>
  );
}
