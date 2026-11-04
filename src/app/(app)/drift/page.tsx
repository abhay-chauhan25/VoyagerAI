import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { ButtonLink } from "@/components/ui/button";
import { loadTravelDna } from "@/lib/dna/queries";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Drift" };

export default async function DriftPage() {
  const user = await requireUser("/drift");
  const dna = await loadTravelDna(await createClient(), user.id);

  return (
    <Screen>
      <ScreenHeader
        title="Drift"
        subline="Swipe through places picked for your taste. Saves become trips."
      />
      <EmptyFrame heading="Today's deck">
        {dna ? (
          <>
            <p className="text-body text-ink">Drift isn&apos;t dealing cards yet.</p>
            <p>Your Travel DNA is ready, so the first deck will be matched to it.</p>
          </>
        ) : (
          <>
            <p className="text-body text-ink">Drift deals places matched to your Travel DNA.</p>
            <p>Set it up first: twelve quick moments and three questions.</p>
            <ButtonLink href="/welcome" className="mt-2 self-start">
              Set up Travel DNA
            </ButtonLink>
          </>
        )}
      </EmptyFrame>
    </Screen>
  );
}
