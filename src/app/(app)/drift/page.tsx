import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";

export const metadata: Metadata = { title: "Drift" };

export default function DriftPage() {
  return (
    <Screen>
      <ScreenHeader
        title="Drift"
        subline="Swipe through places picked for your taste. Saves become trips."
      />
      <EmptyFrame heading="Today's deck">
        <p className="text-body text-ink">Drift isn&apos;t dealing cards yet.</p>
        <p>
          It will deal places matched to your Travel DNA: swipe right to save, left to pass, up for
          more like this.
        </p>
      </EmptyFrame>
    </Screen>
  );
}
