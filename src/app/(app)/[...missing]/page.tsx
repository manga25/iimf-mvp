import { notFound } from "next/navigation";

// Catches every URL no other route matches, so the 404 renders inside the app layout
// ((app)/not-found.tsx) instead of the bare root one. Unauthenticated visitors never
// get here: src/proxy.ts redirects them to /login first.
export default function MissingPage() {
  notFound();
}
