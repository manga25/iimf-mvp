"use client";

import { useEffect } from "react";

// AC-9.4: unexpected errors on the Schedule page are shown as a clear, non-technical message.
export default function ScheduleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-6 py-8 text-center">
      <h2 className="text-base font-semibold text-danger">We couldn’t load the schedule</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-danger">
        Check your internet connection and try again. If the problem continues, reload the page.
      </p>
      <button type="button" onClick={() => retry()} className="btn-secondary mt-4">Try again</button>
    </div>
  );
}
