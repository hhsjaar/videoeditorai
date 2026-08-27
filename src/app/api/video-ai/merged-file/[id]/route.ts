import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { MERGE_OUTPUT_DIR } from "../../merge/route";

// Streams a merged (all-clips-combined) Video AI export from disk with Range
// support — same pattern as /api/video-ai/file/[jobId], just backed by
// MERGE_OUTPUT_DIR instead of the per-clip veoQueue job store.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const filePath = path.join(MERGE_OUTPUT_DIR, `${id}.mp4`);
  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return Response.json({ error: "Video file missing on disk" }, { status: 404 });
  }

  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;

    const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
