import { NextResponse } from "next/server";
import { listJobHistory } from "@/lib/renderQueue";

export async function GET() {
  const jobs = await listJobHistory(50);

  return NextResponse.json({
    jobs: jobs.map((job) => ({
      jobId: job.jobId,
      title: job.title,
      status: job.status,
      progress: job.progress,
      aspectRatio: job.aspectRatio,
      exportPreset: job.exportPreset,
      error: job.error,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
      downloadUrl: job.status === "done" ? `/api/render-download/${job.jobId}` : null,
    })),
  });
}
