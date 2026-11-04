import type { Metadata } from "next";
import Link from "next/link";
import { SignInForms } from "@/components/auth/sign-in-forms";
import { safeNextPath } from "@/lib/auth/routes";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That link has expired or was already used. Request a new one below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorMessage = error ? ERRORS[error] : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[2.75rem] leading-[0.9] font-extrabold uppercase">
          Welcome back
        </h1>
        <p className="text-lead text-muted">Your trips are where you left them.</p>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-control bg-negative-bg px-3 py-2.5 text-ui font-semibold text-negative"
        >
          {errorMessage}
        </p>
      ) : null}
      <SignInForms next={safeNextPath(next)} />
      <p className="text-ui text-muted">
        New to Voyager?{" "}
        <Link href="/sign-up" className="font-semibold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
