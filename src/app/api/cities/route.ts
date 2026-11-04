import { NextResponse, type NextRequest } from "next/server";
import { citySearchSchema } from "@/lib/atlas/schemas";
import { createClient } from "@/lib/supabase/server";

const MAX_RESULTS = 8;

/** Typeahead for adding places: GeoNames cities from the local database. Signed-in users only. */
export async function GET(request: NextRequest) {
  const parsed = citySearchSchema.safeParse({ q: request.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Type at least two characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return NextResponse.json({ error: "Sign in to search places." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("search_cities", {
    query: parsed.data.q,
    max_results: MAX_RESULTS,
  });
  if (error) {
    console.error("City search failed", { code: error.code });
    return NextResponse.json({ error: "Search is unavailable right now." }, { status: 502 });
  }

  const results = data.map((c) => ({
    id: c.geoname_id,
    name: c.name,
    region: c.region,
    countryCode: c.country_code,
  }));
  return NextResponse.json({ results }, { headers: { "Cache-Control": "private, max-age=300" } });
}
