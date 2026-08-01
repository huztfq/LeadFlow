export default function UnsubscribedPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Unsubscribed</h1>
        <p className="text-sm text-zinc-600">
          You have been removed from this email sequence. You will not receive
          further messages from this campaign.
        </p>
      </div>
    </div>
  );
}
