import type { Metadata } from "next";
import Link from "next/link";
import { Screen, ScreenHeader } from "@/components/app/screen";
import { ProfileForm } from "@/components/account/profile-form";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <Screen>
      <ScreenHeader
        action={
          <Link href="/dna" className="text-ui font-semibold underline underline-offset-4">
            Your Travel DNA
          </Link>
        }
        title="Account"
        subline="How you appear to other travellers, and how Voyager looks to you."
      />

      <section
        aria-labelledby="profile-heading"
        className="grid gap-6 border-b border-rule pb-8 md:grid-cols-[18rem_minmax(0,32rem)]"
      >
        <div className="flex flex-col gap-1">
          <h2 id="profile-heading" className="text-body font-semibold">
            Profile
          </h2>
          <p className="text-ui text-muted">Signed in as {user.email}.</p>
        </div>
        <div className="rounded-card bg-panel p-5">
          <ProfileForm
            displayName={user.displayName}
            homeCity={user.homeCity}
            handle={user.handle}
            isPublic={user.isPublic}
          />
          {user.isPublic && user.handle ? (
            <p className="mt-4 text-ui">
              Your profile is live at{" "}
              <Link
                href={`/u/${user.handle}`}
                className="font-semibold underline underline-offset-4"
              >
                /u/{user.handle}
              </Link>
            </p>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="appearance-heading"
        className="grid gap-6 border-b border-rule pb-8 md:grid-cols-[18rem_minmax(0,32rem)]"
      >
        <div className="flex flex-col gap-1">
          <h2 id="appearance-heading" className="text-body font-semibold">
            Appearance
          </h2>
          <p className="text-ui text-muted">Auto follows your device. Saved on this device only.</p>
        </div>
        <ThemeToggle className="self-start" />
      </section>

      <section
        aria-labelledby="session-heading"
        className="grid gap-6 md:grid-cols-[18rem_minmax(0,32rem)]"
      >
        <div className="flex flex-col gap-1">
          <h2 id="session-heading" className="text-body font-semibold">
            Session
          </h2>
          <p className="text-ui text-muted">Signing out ends your session in this browser.</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="pressable min-h-10 rounded-control border border-control bg-panel px-4 text-ui font-semibold hover:bg-raised"
          >
            Sign out
          </button>
        </form>
      </section>
    </Screen>
  );
}
