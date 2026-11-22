import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-muted px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">IIMF</p>
          <h1 className="mt-1 text-2xl font-semibold">Instituto de Inglês Margarida Freitas</h1>
          <p className="mt-2 text-sm text-muted">Log in to manage students, classes and payments.</p>
        </div>
        <div className="card p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
