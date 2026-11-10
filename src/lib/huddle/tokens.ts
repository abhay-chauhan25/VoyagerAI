import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 24 random bytes: unguessable, and short enough to share as a link. */
const TOKEN_BYTES = 24;

/** A new invite secret and the hash stored in its place (the database never sees the secret). */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

/** Matches the database's invite_hash(): SHA-256 of the UTF-8 text, as hex. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Invite secrets as they appear in links; anything else is rejected before a database call. */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{32}$/;
