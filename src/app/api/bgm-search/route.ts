import { NextRequest, NextResponse } from "next/server";

// GET /api/bgm-search?q=<query>
// Searches Freesound.org for background-music-length tracks, filtered to
// CC0-licensed sounds only (free to use commercially, no attribution required)
// so results are safe to use in brand marketing videos without any licensing risk.
export async function GET(req: NextRequest) {
  const query = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!query) {
    return NextResponse.json({ error: "Query pencarian tidak boleh kosong." }, { status: 400 });
  }

  const apiKey = process.env.FREESOUND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FREESOUND_API_KEY belum dikonfigurasi di .env.local" }, { status: 500 });
  }

  const params = new URLSearchParams({
    query,
    filter: 'license:"Creative Commons 0" duration:[15 TO 300]',
    fields: "id,name,duration,previews,username,tags",
    page_size: "30",
    sort: "downloads_desc",
  });

  try {
    const res = await fetch(`https://freesound.org/apiv2/search/text/?${params.toString()}`, {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json({ error: `Freesound API error (${res.status}): ${body.slice(0, 200)}` }, { status: 502 });
    }

    const data = await res.json();
    const tracks = (data.results || []).map((r: any) => ({
      id: String(r.id),
      name: r.name as string,
      duration: r.duration as number,
      url: r.previews?.["preview-hq-mp3"] as string,
      username: r.username as string,
      tags: (r.tags || []).slice(0, 5) as string[],
    })).filter((t: any) => t.url);

    return NextResponse.json({ tracks });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Gagal menghubungi Freesound API." }, { status: 500 });
  }
}
