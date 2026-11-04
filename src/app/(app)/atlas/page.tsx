import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";

export const metadata: Metadata = { title: "Atlas" };

export default function AtlasPage() {
  return (
    <Screen>
      <ScreenHeader title="Atlas" subline="Every place you've been, on one map." />
      <EmptyFrame heading="Places visited">
        <p className="text-body text-ink">0 countries, 0 cities.</p>
        <p>
          Mark places you&apos;ve been and finished trips will add their stops here automatically.
        </p>
      </EmptyFrame>
    </Screen>
  );
}
