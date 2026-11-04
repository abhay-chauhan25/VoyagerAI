import type { Interest } from "@/lib/interests";

/**
 * How OpenStreetMap tags map to Voyager interests, and the label shown on a card. Order matters:
 * the first matching rule names the category.
 */
type Rule = {
  key: string;
  values: readonly string[] | "*";
  category: string;
  interests: Interest[];
};

export const TAG_RULES: readonly Rule[] = [
  { key: "tourism", values: ["museum"], category: "Museum", interests: ["Museums", "History"] },
  { key: "tourism", values: ["gallery"], category: "Gallery", interests: ["Art", "Museums"] },
  { key: "tourism", values: ["artwork"], category: "Public art", interests: ["Art"] },
  { key: "tourism", values: ["viewpoint"], category: "Viewpoint", interests: ["Viewpoints"] },
  {
    key: "historic",
    values: ["castle", "fort", "palace"],
    category: "Castle",
    interests: ["History", "Architecture"],
  },
  {
    key: "historic",
    values: ["monument", "memorial", "ruins", "archaeological_site"],
    category: "Historic site",
    interests: ["History"],
  },
  { key: "amenity", values: ["marketplace"], category: "Market", interests: ["Markets", "Food"] },
  { key: "amenity", values: ["restaurant"], category: "Restaurant", interests: ["Food"] },
  { key: "amenity", values: ["cafe"], category: "Café", interests: ["Coffee"] },
  {
    key: "amenity",
    values: ["bar", "pub", "nightclub"],
    category: "Bar",
    interests: ["Nightlife"],
  },
  {
    key: "amenity",
    values: ["music_venue"],
    category: "Music venue",
    interests: ["Music", "Nightlife"],
  },
  {
    key: "amenity",
    values: ["theatre", "arts_centre"],
    category: "Arts venue",
    interests: ["Art", "Music"],
  },
  { key: "shop", values: ["wine"], category: "Wine shop", interests: ["Wine"] },
  { key: "craft", values: ["winery"], category: "Winery", interests: ["Wine"] },
  {
    key: "leisure",
    values: ["park", "garden", "nature_reserve"],
    category: "Park",
    interests: ["Nature"],
  },
  { key: "natural", values: ["beach"], category: "Beach", interests: ["Beaches", "Nature"] },
  {
    key: "building",
    values: ["cathedral", "church"],
    category: "Landmark building",
    interests: ["Architecture", "History"],
  },
  {
    key: "shop",
    values: ["mall", "department_store", "second_hand", "antiques"],
    category: "Shopping",
    interests: ["Shopping"],
  },
] as const;

export function classify(
  tags: Readonly<Record<string, string>>,
): { category: string; interests: Interest[] } | null {
  for (const rule of TAG_RULES) {
    const value = tags[rule.key];
    if (value && (rule.values === "*" || rule.values.includes(value))) {
      return { category: rule.category, interests: [...rule.interests] };
    }
  }
  return null;
}

/** The Overpass filters for every rule, grouped by key, e.g. ["tourism"~"^(museum|gallery)$"]. */
export function overpassFilters(): string[] {
  const byKey = new Map<string, Set<string>>();
  for (const rule of TAG_RULES) {
    const set = byKey.get(rule.key) ?? new Set<string>();
    if (rule.values !== "*") for (const v of rule.values) set.add(v);
    byKey.set(rule.key, set);
  }
  return [...byKey].map(([key, values]) => `["${key}"~"^(${[...values].join("|")})$"]`);
}
