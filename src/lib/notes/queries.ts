import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { StopPlace } from "@/lib/trips/schemas";
import type { Visibility } from "./schemas";

type Client = SupabaseClient<Database>;

const PHOTO_BUCKET = "note-photos";
const SIGNED_URL_SECONDS = 60 * 60;
const FEED_LIMIT = 40;

export type FeedView = "following" | "everyone" | "mine";

export type NotePhoto = { id: string; url: string; alt: string };

export type FeedNote = {
  kind: "note";
  id: string;
  authorId: string;
  authorName: string;
  placeName: string;
  cityName: string;
  rating: number;
  body: string;
  visibility: Visibility;
  at: string;
  photos: NotePhoto[];
};

export type FeedStory = {
  kind: "story";
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  cityName: string;
  dayCount: number;
  stopCount: number;
  visibility: Visibility;
  at: string;
};

export type FeedItem = FeedNote | FeedStory;

export type StorySnapshot = {
  city_name: string;
  country_code: string;
  day_count: number;
  days: { day_index: number; title: string | null }[];
  stops: { day_index: number; position: number; source_key: string; place: StopPlace }[];
};

/** The people the traveller follows, by id. */
export async function loadFollowing(supabase: Client, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("followee_id")
    .eq("follower_id", userId);
  if (error) throw new Error(`Could not load follows (${error.code})`);
  return data.map((row) => row.followee_id);
}

/**
 * Notes and stories, newest first. Row-level security already limits these to what the reader may
 * see; the view only narrows that further (people they follow, or just their own).
 */
export async function loadFeed(
  supabase: Client,
  userId: string,
  view: FeedView,
): Promise<FeedItem[]> {
  const authors =
    view === "mine"
      ? [userId]
      : view === "following"
        ? await loadFollowing(supabase, userId)
        : null;
  if (authors && authors.length === 0) return [];

  let notes = supabase
    .from("notes")
    .select(
      "id, user_id, author_name, place_name, city_name, rating, body, visibility, created_at, photos:note_photos(id, path, alt, position)",
    )
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  let stories = supabase
    .from("trip_stories")
    .select("trip_id, user_id, author_name, title, body, visibility, snapshot, published_at")
    .order("published_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (authors) {
    notes = notes.in("user_id", authors);
    stories = stories.in("user_id", authors);
  } else {
    // "Everyone" is other people's public writing; the traveller's own is under "Mine".
    notes = notes.eq("visibility", "public");
    stories = stories.eq("visibility", "public");
  }
  const [noteRows, storyRows] = await Promise.all([notes, stories]);
  if (noteRows.error) throw new Error(`Could not load notes (${noteRows.error.code})`);
  if (storyRows.error) throw new Error(`Could not load stories (${storyRows.error.code})`);

  const paths = noteRows.data.flatMap((note) => note.photos.map((photo) => photo.path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    // Short-lived links, made with the reader's own access: storage refuses any they may not see.
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }

  const items: FeedItem[] = [
    ...noteRows.data.map((note): FeedNote => ({
      kind: "note",
      id: note.id,
      authorId: note.user_id,
      authorName: note.author_name,
      placeName: note.place_name,
      cityName: note.city_name,
      rating: note.rating,
      body: note.body,
      visibility: note.visibility,
      at: note.created_at,
      photos: [...note.photos]
        .sort((a, b) => a.position - b.position)
        .flatMap((photo) => {
          const url = urls.get(photo.path);
          return url ? [{ id: photo.id, url, alt: photo.alt }] : [];
        }),
    })),
    ...storyRows.data.map((story): FeedStory => {
      const snapshot = story.snapshot as unknown as StorySnapshot;
      return {
        kind: "story",
        id: story.trip_id,
        authorId: story.user_id,
        authorName: story.author_name,
        title: story.title,
        body: story.body,
        cityName: snapshot.city_name,
        dayCount: snapshot.day_count,
        stopCount: snapshot.stops.length,
        visibility: story.visibility,
        at: story.published_at,
      };
    }),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
}

export type Story = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  visibility: Visibility;
  publishedAt: string;
  snapshot: StorySnapshot;
  forks: number;
};

/** One story the reader may see, or null. */
export async function loadStory(supabase: Client, storyId: string): Promise<Story | null> {
  const [{ data, error }, forks] = await Promise.all([
    supabase
      .from("trip_stories")
      .select("trip_id, user_id, author_name, title, body, visibility, snapshot, published_at")
      .eq("trip_id", storyId)
      .maybeSingle(),
    supabase.rpc("story_fork_count", { p_story: storyId }),
  ]);
  if (error) throw new Error(`Could not load the story (${error.code})`);
  if (!data) return null;
  return {
    id: data.trip_id,
    authorId: data.user_id,
    authorName: data.author_name,
    title: data.title,
    body: data.body,
    visibility: data.visibility,
    publishedAt: data.published_at,
    snapshot: data.snapshot as unknown as StorySnapshot,
    forks: forks.data ?? 0,
  };
}

export type NotablePlace = { tripId: string; tripTitle: string; sourceKey: string; name: string };

/** Places on the traveller's trips: what a note can be written about. */
export async function loadNotablePlaces(supabase: Client): Promise<NotablePlace[]> {
  const { data, error } = await supabase
    .from("trip_stops")
    .select("trip_id, source_key, place, day_index, position, trip:trips!inner(title)")
    .order("day_index")
    .order("position");
  if (error) throw new Error(`Could not load your places (${error.code})`);
  return data.map((row) => ({
    tripId: row.trip_id,
    tripTitle: row.trip.title,
    sourceKey: row.source_key,
    name: (row.place as unknown as StopPlace).name,
  }));
}

/** Public handles for a set of authors, so their names can link to their profiles. */
export async function loadHandles(supabase: Client, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, handle").in("id", ids);
  if (error) throw new Error(`Could not load profiles (${error.code})`);
  return new Map(data.flatMap((row) => (row.handle ? [[row.id, row.handle] as const] : [])));
}
