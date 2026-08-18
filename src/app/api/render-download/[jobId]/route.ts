import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { getJob } from "@/lib/renderQueue";
import { rm } from "fs/promises";
import { Readable } from "stream";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status !== "done" || !job.outputPath) {
    return NextResponse.json(
      { error: `Job is not ready (status: ${job.status})` },
      { status: 409 }
    );
  }

  let fileSize: number;
  try {
    fileSize = statSync(job.outputPath).size;
  } catch {
    return NextResponse.json({ error: "Output file not found on server" }, { status: 404 });
  }

  const filename = `AutoVideo_${jobId.slice(-8)}_${Date.now()}.mp4`;
  const fileStream = createReadStream(job.outputPath);

  // Convert Node.js Readable to Web ReadableStream
  const webStream = Readable.toWeb(fileStream) as ReadableStream;

  // Schedule file cleanup after stream starts (non-blocking)
  // Give 60s buffer in case client downloads slowly
  setTimeout(() => {
    rm(job.outputPath!, { force: true }).catch(() => {});
  }, 60 * 1000);

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": fileSize.toString(),
      "Cache-Control": "no-store",
    },
  });
}
