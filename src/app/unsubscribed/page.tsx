export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="lf-card flex w-full max-w-sm flex-col gap-3 p-8 text-center">
        <p className="lf-chip mx-auto">Leadflow</p>
        <h1 className="lf-display text-3xl font-semibold text-[var(--ink)]">Unsubscribed</h1>
        <p className="text-sm leading-relaxed text-[var(--muted)]">
          You have been removed from this email sequence. You will not receive further messages from
          this campaign.
        </p>
      </div>
    </div>
  );
}
