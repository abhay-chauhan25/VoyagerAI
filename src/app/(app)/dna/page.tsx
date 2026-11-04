import type { Metadata } from "next";
import Link from "next/link";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";
import { DnaEditor, type EditorTrait } from "@/components/dna/dna-editor";
import { ButtonLink } from "@/components/ui/button";
import { loadReactions, loadTravelDna } from "@/lib/dna/queries";
import { rankTraits } from "@/lib/dna/score";
import { BUDGET_LABELS, COMPANION_LABELS, PACE_LABELS, COMPANIONS } from "@/lib/dna/schemas";
import { INTERESTS } from "@/lib/interests";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "Travel DNA" };

export default async function DnaPage() {
  const user = await requireUser("/dna");
  const supabase = await createClient();
  const [dna, reactions] = await Promise.all([
    loadTravelDna(supabase, user.id),
    loadReactions(supabase, user.id),
  ]);

  if (!dna) {
    return (
      <Screen>
        <ScreenHeader
          title="Travel DNA"
          subline="What you love about travelling, in a form Voyager can plan with."
        />
        <EmptyFrame heading="Not set up yet">
          <p className="text-body text-ink">
            Twelve quick moments and three questions. About two minutes.
          </p>
          <ButtonLink href="/welcome" className="mt-2 self-start">
            Set up Travel DNA
          </ButtonLink>
        </EmptyFrame>
      </Screen>
    );
  }

  const ranked = rankTraits(dna.weights, reactions);
  const positive = new Map(ranked.map((t) => [t.interest, t]));
  const top = ranked.slice(0, 3).map((t) => t.interest);
  // Every interest is editable: ranked traits first, then the rest by weight, unknowns last.
  const traits: EditorTrait[] = [...INTERESTS]
    .sort((a, b) => (dna.weights[b] ?? -2) - (dna.weights[a] ?? -2))
    .map((interest) => ({
      interest,
      weight: dna.weights[interest] ?? null,
      because: (positive.get(interest)?.because ?? []).slice(0, 2).map((scene) => scene.title),
    }));
  const companions = dna.companions.filter((c): c is (typeof COMPANIONS)[number] =>
    (COMPANIONS as readonly string[]).includes(c),
  );

  return (
    <Screen>
      <ScreenHeader
        title="Travel DNA"
        subline={
          top.length > 0
            ? `You light up for ${top.join(", ").replace(/, ([^,]*)$/, " and $1")}. ${PACE_LABELS[dna.pace]} pace, ${BUDGET_LABELS[
                dna.budget
              ].toLowerCase()} budget, ${companions.map((c) => COMPANION_LABELS[c].toLowerCase()).join(" or ")}.`
            : "Nothing stood out yet. Retake the deck or nudge the interests below."
        }
        action={
          <Link href="/welcome" className="text-ui font-semibold underline underline-offset-4">
            Retake the deck
          </Link>
        }
      />
      <DnaEditor traits={traits} pace={dna.pace} budget={dna.budget} companions={companions} />
    </Screen>
  );
}
