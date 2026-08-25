import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/renderQueue";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = await getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const elapsed = job.startedAt
    ? Math.round((Date.now() - job.startedAt) / 1000)
    : null;

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status,           // "pending" | "rendering" | "done" | "error"
    progress: job.progress,       // 0-100
    renderedFrames: job.renderedFrames,
    totalFrames: job.totalFrames,
    elapsedSec: elapsed,
    error: job.error,
    allocatedChunks: job.allocatedChunks, // how many parallel Lambda chunks this job got (multi-user budget sharing)
    downloadUrl: job.status === "done" ? `/api/render-download/${jobId}` : null,
  });
}
