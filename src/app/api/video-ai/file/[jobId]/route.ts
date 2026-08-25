import { NextRequest } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { getVeoJob, OUTPUT_DIR } from "@/lib/veoQueue";

// Streams a generated Veo clip from disk with Range support (needed for
// <video> seeking/scrubbing). Deliberately a dynamic route rather than a
// public/ static file — see the comment in veoQueue.ts for why.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId || !/^[a-zA-Z0-9-]+$/.test(jobId)) {
    return Response.json({ error: "Invalid job id" }, { status: 400 });
  }

  const job = await getVeoJob(jobId);
  if (!job || job.status !== "done") {
    return Response.json({ error: "Video not found or not ready" }, { status: 404 });
  }

  const filePath = path.join(OUTPUT_DIR, `${jobId}.mp4`);
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
