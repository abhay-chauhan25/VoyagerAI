import Link from "next/link";
import { Wordmark } from "@/components/brand/mark";
import { requireUser } from "@/lib/user/current-user";

/** A focused, shell-free frame for first-run flows. */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/welcome");
  return (
    <div className="flex min-h-svh flex-col bg-ground text-ink">
      <header className="flex h-14 items-center justify-between px-4 sm:px-8">
        <Link href="/trips" aria-label="Voyager, go to Trips" className="rounded-control">
          <Wordmark />
        </Link>
        <Link
          href="/trips"
          className="text-ui text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Skip for now
        </Link>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
