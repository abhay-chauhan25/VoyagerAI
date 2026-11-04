import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { TRIP_IDEA_MAX_LENGTH } from "@/lib/auth/schemas";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ trip?: string }>;
}) {
  const { trip } = await searchParams;
  const tripIdea =
    typeof trip === "string" ? trip.trim().slice(0, TRIP_IDEA_MAX_LENGTH) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[2.75rem] leading-[0.9] font-extrabold uppercase">
          Start a voyage
        </h1>
        <p className="text-lead text-muted">
          One account for your trips, your map and your friends.
        </p>
      </div>
      <SignUpForm tripIdea={tripIdea} />
      <p className="text-ui text-muted">
        Already travelling with us?{" "}
        <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
