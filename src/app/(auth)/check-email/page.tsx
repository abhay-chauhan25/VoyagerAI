import type { Metadata } from "next";
import Link from "next/link";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Check your email" };

const LOCAL_INBOX_URL = "http://127.0.0.1:54324";

/** Local Supabase captures every email in its own inbox instead of sending it. */
function usesLocalSupabase(): boolean {
  const host = new URL(publicEnv().NEXT_PUBLIC_SUPABASE_URL).hostname;
  return host === "127.0.0.1" || host === "localhost";
}

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; email?: string }>;
}) {
  const { kind, email } = await searchParams;
  const isMagicLink = kind === "magic-link";
  const shownEmail = typeof email === "string" && email.length <= 254 ? email : "your inbox";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.75rem] leading-[0.9] font-extrabold uppercase">
        Check your email
      </h1>
      <p className="text-lead">
        {isMagicLink
          ? `If an account exists for ${shownEmail}, a sign-in link is on its way. It works once and expires in an hour.`
          : `We sent a confirmation link to ${shownEmail}. Open it on this device to finish creating your account.`}
      </p>
      {usesLocalSupabase() ? (
        <p className="rounded-control bg-surface px-4 py-3 text-ui">
          Running locally: emails don&apos;t leave your machine. Open the local inbox at{" "}
          <a href={LOCAL_INBOX_URL} className="font-semibold underline underline-offset-4">
            {LOCAL_INBOX_URL}
          </a>
          .
        </p>
      ) : null}
      <p className="text-ui text-muted">
        Wrong address?{" "}
        <Link
          href={isMagicLink ? "/sign-in" : "/sign-up"}
          className="font-semibold text-ink underline underline-offset-4"
        >
          Go back
        </Link>
      </p>
    </div>
  );
}
