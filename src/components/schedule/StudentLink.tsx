import Link from "next/link";

/** A student's name linking to their profile (weekly availability), used across the Schedule page. */
export function StudentLink({ id, name }: { id: string; name: string }) {
  return (
    <Link
      href={`/students/${id}`}
      className="rounded-sm text-sm font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
    >
      {name}
    </Link>
  );
}
