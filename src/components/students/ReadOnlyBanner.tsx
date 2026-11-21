/** AC-2.7: explains why student data can no longer be changed. */
export function ReadOnlyBanner() {
  return (
    <div role="status" className="mb-6 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
      <p className="font-semibold">Students are read-only for this term</p>
      <p className="mt-0.5">
        The schedule has been approved, so students and their availability are frozen until the term ends (31 July).
      </p>
    </div>
  );
}
