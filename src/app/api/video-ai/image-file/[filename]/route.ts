import { createReadStream } from "fs";
import { stat } from "fs/promises";
import { Readable } from "stream";
import path from "path";
import { IMAGE_OUTPUT_DIR } from "../../image-storyboard/route";

// Streams a generated storyboard shot image from disk — same "outside public/,
// served by a dynamic route" pattern as veoQueue.ts's video files, since
// `next start` doesn't pick up files written to public/ after boot.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || !/^[a-zA-Z0-9-]+\.(jpg|png)$/.test(filename)) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(IMAGE_OUTPUT_DIR, filename);
  let fileSize: number;
  try {
    fileSize = (await stat(filePath)).size;
  } catch {
    return Response.json({ error: "Image not found on disk" }, { status: 404 });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": filename.endsWith(".png") ? "image/png" : "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
