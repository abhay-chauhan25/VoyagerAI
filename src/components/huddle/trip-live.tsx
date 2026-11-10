"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type Presence = { userId: string; name: string; day: number | null };

type Live = {
  /** Members on the trip right now (including the viewer), with the day they're looking at. */
  here: Presence[];
  /** Says which day the viewer is looking at, for everyone else's presence. */
  setDay: (day: number | null) => void;
  /** While true (a drag in progress), refreshes from others wait so the drag isn't disturbed. */
  setPaused: (paused: boolean) => void;
  connected: boolean;
};

const LiveContext = createContext<Live>({
  here: [],
  setDay: () => {},
  setPaused: () => {},
  connected: false,
});

export function useLive(): Live {
  return useContext(LiveContext);
}

/** Changes arriving close together cause one refresh. */
const REFRESH_DELAY_MS = 350;

/**
 * Keeps a trip live for its members: presence (who is here, on which day) and a refresh whenever
 * anyone changes the trip. Both travel on the trip's private Realtime channel, which the database
 * opens to the trip's members only.
 */
export function TripLive({
  tripId,
  me,
  children,
}: {
  tripId: string;
  me: { id: string; name: string };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [here, setHere] = useState<Presence[]>([]);
  const [connected, setConnected] = useState(false);
  const channel = useRef<RealtimeChannel | null>(null);
  const presence = useRef<Presence>({ userId: me.id, name: me.name, day: null });
  const paused = useRef(false);
  const owed = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (paused.current) owed.current = true;
      else router.refresh();
    }, REFRESH_DELAY_MS);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      // Private channels are authorised with the traveller's own session.
      await supabase.realtime.setAuth();
      if (cancelled) return;
      const ch = supabase.channel(`trip:${tripId}`, {
        config: { private: true, presence: { key: me.id } },
      });
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<Presence>();
        const seen = new Map<string, Presence>();
        for (const entries of Object.values(state)) {
          const latest = entries.at(-1);
          if (latest)
            seen.set(latest.userId, { userId: latest.userId, name: latest.name, day: latest.day });
        }
        setHere([...seen.values()]);
      });
      ch.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        refresh,
      );
      ch.subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void ch.track(presence.current);
      });
      channel.current = ch;
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      if (channel.current) void supabase.removeChannel(channel.current);
      channel.current = null;
    };
  }, [tripId, me.id, refresh]);

  const setDay = useCallback((day: number | null) => {
    if (presence.current.day === day) return;
    presence.current = { ...presence.current, day };
    void channel.current?.track(presence.current);
  }, []);

  const setPaused = useCallback(
    (value: boolean) => {
      paused.current = value;
      if (!value && owed.current) {
        owed.current = false;
        refresh();
      }
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ here, setDay, setPaused, connected }),
    [here, setDay, setPaused, connected],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}
