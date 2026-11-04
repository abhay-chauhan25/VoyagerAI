import type { Metadata } from "next";
import { PictureCredits } from "@/components/credits/picture-credits";
import { Onboarding } from "@/components/dna/onboarding";
import { SCENES } from "@/lib/dna/scenes";

export const metadata: Metadata = { title: "Your Travel DNA" };

export default function WelcomePage() {
  // Only what the client needs: ids, words and pictures. Scoring signals stay on the server.
  const scenes = SCENES.map(({ id, title, photo, alt }) => ({ id, title, photo, alt }));
  return (
    <>
      <Onboarding scenes={scenes} />
      <details className="mx-auto w-full max-w-[40rem] px-4 pb-8 text-meta text-muted">
        <summary className="cursor-pointer py-2">Photo credits</summary>
        <PictureCredits set="scenes" />
      </details>
    </>
  );
}
