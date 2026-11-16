"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/shell/avatar";
import { INTEREST_HUE, hueStyle } from "@/lib/hues";
import {
  createInviteLink,
  inviteByHandle,
  inviteFriend,
  removeMember,
  revokeInviteLink,
  setMemberRole,
  type HuddleResult,
} from "@/lib/huddle/actions";
import { PACE_LABELS } from "@/lib/dna/schemas";
import type { InviteLink, PendingPersonInvite, TripMember } from "@/lib/huddle/queries";
import type { TripRole } from "@/lib/trips/queries";
import { useLive } from "./trip-live";

const ROLE_LABELS: Record<TripRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};
const expiryFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

type Props = {
  /** The owner's friends, for one-press invites. */
  friends?: readonly { id: string; name: string }[];
  tripId: string;
  meId: string;
  myRole: TripRole;
  members: TripMember[];
  links: InviteLink[];
  personInvites: PendingPersonInvite[];
};

/** Who is on the trip, who is here right now, and (for the owner) roles and invites. */
export function MembersPanel({
  tripId,
  meId,
  myRole,
  members,
  links,
  personInvites,
  friends = [],
}: Props) {
  const onTrip = new Set(members.map((member) => member.id));
  const invitable = friends.filter((friend) => !onTrip.has(friend.id));
  const { here, connected } = useLive();
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();
  const owner = myRole === "owner";
  const present = new Map(here.map((p) => [p.userId, p]));

  const run = (action: () => Promise<HuddleResult>, onOk?: (r: HuddleResult) => void) =>
    start(async () => {
      const result = await action();
      if (!result.ok) setMessage({ text: result.message, tone: "error" });
      else {
        setMessage(result.message ? { text: result.message, tone: "ok" } : null);
        onOk?.(result);
      }
    });

  return (
    <section aria-labelledby="travellers-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="travellers-heading" className="text-body font-semibold">
          Travellers
        </h2>
        <span className="text-meta text-muted" aria-live="polite">
          {connected ? `${here.length} here now` : "Connecting to live updates…"}
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-rule rounded-card bg-panel">
        {members.map((member) => {
          const live = present.get(member.id);
          return (
            <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="relative">
                <Avatar id={member.id} name={member.name} size={32} />
                {live ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-panel bg-positive"
                  />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-ui font-semibold">
                  {member.name}
                  {member.id === meId ? " (you)" : ""}
                  <span className="sr-only">{live ? ", here now" : ""}</span>
                </span>
                <span className="text-meta text-muted">
                  {ROLE_LABELS[member.role]}
                  {member.pace ? ` · ${PACE_LABELS[member.pace]} pace` : ""}
                  {live && live.day !== null
                    ? ` · looking at day ${live.day + 1}`
                    : live
                      ? " · here now"
                      : ""}
                </span>
                {member.top.length ? (
                  <ul
                    className="mt-1 flex flex-wrap gap-1"
                    aria-label={`${member.name}'s top interests`}
                  >
                    {member.top.map((interest) => (
                      <li
                        key={interest}
                        style={hueStyle(INTEREST_HUE[interest])}
                        className="hue-chip rounded-full px-2 py-0.5 text-[0.75rem]"
                      >
                        {interest}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </span>
              {owner && member.role !== "owner" ? (
                <span className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${member.id}`}>
                    Role for {member.name}
                  </label>
                  <select
                    id={`role-${member.id}`}
                    value={member.role}
                    disabled={pending}
                    onChange={(e) =>
                      run(() =>
                        setMemberRole({
                          tripId,
                          userId: member.id,
                          role: e.target.value as "editor" | "viewer",
                        }),
                      )
                    }
                    className="min-h-9 rounded-control border border-control bg-panel px-2 text-meta"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => removeMember({ tripId, userId: member.id }))}
                    className="pressable min-h-9 px-1 text-meta text-muted underline-offset-4 hover:text-negative hover:underline"
                  >
                    Remove
                  </button>
                </span>
              ) : null}
              {!owner && member.id === meId ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeMember({ tripId, userId: meId }))}
                  className="pressable min-h-9 px-1 text-meta text-muted underline-offset-4 hover:text-negative hover:underline"
                >
                  Leave trip
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div aria-live="polite">
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`text-meta font-semibold ${message.tone === "error" ? "text-negative" : "text-positive"}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>

      {owner ? (
        <Invites
          tripId={tripId}
          links={links}
          personInvites={personInvites}
          invitable={invitable}
          pending={pending}
          run={run}
        />
      ) : null}
    </section>
  );
}

function Invites({
  tripId,
  links,
  personInvites,
  invitable,
  pending,
  run,
}: {
  /** Friends of the owner who aren't on the trip yet. */
  invitable: readonly { id: string; name: string }[];
  tripId: string;
  links: InviteLink[];
  personInvites: PendingPersonInvite[];
  pending: boolean;
  run: (action: () => Promise<HuddleResult>, onOk?: (r: HuddleResult) => void) => void;
}) {
  const [linkRole, setLinkRole] = useState<"editor" | "viewer">("editor");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [handle, setHandle] = useState("");
  const [handleRole, setHandleRole] = useState<"editor" | "viewer">("editor");

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setCopied(false); // The link stays selectable on screen.
    }
  };

  return (
    <details className="rounded-card border border-border bg-panel px-4 py-3">
      <summary className="cursor-pointer text-ui font-semibold">Invite people</summary>
      <div className="mt-4 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-meta text-muted">
            A link anyone signed in can use to join, for 7 days. Joining shares their name, pace and
            top three interests with the group.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="link-role" className="text-meta font-semibold">
              Joins as
            </label>
            <select
              id="link-role"
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as "editor" | "viewer")}
              className="min-h-9 rounded-control border border-control bg-panel px-2 text-meta"
            >
              <option value="editor">Editor (can change the plan)</option>
              <option value="viewer">Viewer (can swipe and vote)</option>
            </select>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => createInviteLink({ tripId, role: linkRole }),
                  (r) => {
                    if (r.ok && r.link) {
                      setFresh(r.link);
                      setCopied(false);
                    }
                  },
                )
              }
              className="pressable min-h-9 rounded-control bg-primary px-3 text-meta font-semibold text-primary-ink disabled:opacity-60"
            >
              Create link
            </button>
          </div>
          {fresh ? (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="fresh-link" className="sr-only">
                New invite link
              </label>
              <input
                id="fresh-link"
                readOnly
                value={fresh}
                onFocus={(e) => e.currentTarget.select()}
                className="min-h-9 min-w-0 flex-1 rounded-control border border-control bg-raised px-2 text-meta"
              />
              <button
                type="button"
                onClick={copy}
                className="pressable min-h-9 rounded-control border border-control px-3 text-meta font-semibold hover:bg-raised"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          ) : null}
          {links.length > 0 ? (
            <ul className="flex flex-col gap-1 text-meta" aria-label="Active invite links">
              {links.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted">
                    {ROLE_LABELS[link.role]} link ·{" "}
                    {link.usable
                      ? `expires ${expiryFormat.format(new Date(link.expiresAt))}`
                      : "expired"}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => revokeInviteLink({ tripId, inviteId: link.id }))}
                    className="pressable min-h-8 px-1 text-muted underline-offset-4 hover:text-negative hover:underline"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {invitable.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h4 className="text-meta font-semibold">Invite a friend</h4>
            <ul className="flex flex-wrap gap-2" aria-label="Friends you can invite">
              {invitable.map((friend) => (
                <li key={friend.id}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={`Invite ${friend.name} as ${handleRole === "editor" ? "an editor" : "a viewer"}`}
                    onClick={() =>
                      run(() => inviteFriend({ tripId, friendId: friend.id, role: handleRole }))
                    }
                    className="pressable flex min-h-9 items-center gap-1.5 rounded-control border border-control px-3 text-meta font-semibold hover:bg-raised disabled:opacity-60"
                  >
                    <span aria-hidden="true">+</span>
                    {friend.name}
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-meta text-muted">
              Joins as {handleRole === "editor" ? "an editor" : "a viewer"}; change the role below.
            </p>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => inviteByHandle({ tripId, handle, role: handleRole }),
              () => setHandle(""),
            );
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="invite-handle" className="text-meta font-semibold">
            Invite by handle
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="invite-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@kai_example"
              spellCheck={false}
              aria-describedby="invite-handle-hint"
              className="min-h-9 min-w-0 flex-1 rounded-control border border-control bg-panel px-2 text-ui"
            />
            <label className="sr-only" htmlFor="handle-role">
              Role for the invited traveller
            </label>
            <select
              id="handle-role"
              value={handleRole}
              onChange={(e) => setHandleRole(e.target.value as "editor" | "viewer")}
              className="min-h-9 rounded-control border border-control bg-panel px-2 text-meta"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={pending || handle.trim().length < 3}
              className="pressable min-h-9 rounded-control border border-control px-3 text-meta font-semibold hover:bg-raised disabled:opacity-60"
            >
              Invite
            </button>
          </div>
          <p id="invite-handle-hint" className="text-meta text-muted">
            Their Voyager handle, set on their Account page. They accept on their Trips page.
          </p>
          {personInvites.length > 0 ? (
            <p className="text-meta text-muted">
              Waiting to answer:{" "}
              {personInvites
                .map((i) => `${i.name} (${ROLE_LABELS[i.role].toLowerCase()})`)
                .join(", ")}
            </p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
