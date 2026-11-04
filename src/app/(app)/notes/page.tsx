import type { Metadata } from "next";
import { EmptyFrame, Screen, ScreenHeader } from "@/components/app/screen";

export const metadata: Metadata = { title: "Field Notes" };

export default function FieldNotesPage() {
  return (
    <Screen>
      <ScreenHeader
        title="Field Notes"
        subline="Stories, tips and trips from travellers you follow."
      />
      <EmptyFrame heading="From people you follow">
        <p className="text-body text-ink">You aren&apos;t following anyone yet.</p>
        <p>
          Notes are tied to real places and trips, so anything you read here can go straight into a
          plan.
        </p>
      </EmptyFrame>
    </Screen>
  );
}
