import { Link } from "react-router-dom";
import { ArrowLeft, FileQuestion } from "lucide-react";

export function NotFoundPage() {
  return <main className="grid min-h-[100svh] place-items-center bg-[var(--background)] px-5 text-[var(--foreground)]">
    <div className="w-full max-w-md text-center">
      <FileQuestion className="mx-auto size-10 text-[var(--primary)]" strokeWidth={1.5} aria-hidden />
      <p className="mt-5 text-xs font-bold uppercase text-[var(--primary)]">404</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
        This page does not exist or has moved.
      </p>
      <nav className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"><ArrowLeft className="size-4" />Dashboard</Link>
        <Link to="/track" className="inline-flex items-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold">Track a request</Link>
      </nav>
    </div>
  </main>;
}
