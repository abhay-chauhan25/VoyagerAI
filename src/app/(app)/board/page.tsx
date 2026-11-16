import type { Metadata } from "next";
import { BoardDeck } from "@/components/boarding/board-deck";
import { requireUser } from "@/lib/user/current-user";

export const metadata: Metadata = { title: "The plane" };

export default async function BoardPage() {
  const user = await requireUser("/board");
  const firstName = user.displayName.trim().split(/\s+/)[0] || "traveller";
  return <BoardDeck name={firstName} />;
}
