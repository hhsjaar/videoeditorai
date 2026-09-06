import { NextRequest, NextResponse } from "next/server";
import { getVeoJob } from "@/lib/veoQueue";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const session = await auth();
  const job = await getVeoJob(jobId);
  if (!job || job.userId !== session?.user?.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    status: job.status, // "pending" | "generating" | "done" | "error"
    videoUrl: job.videoUrl,
    error: job.error,
    actualDurationSeconds: job.actualDurationSeconds ?? null,
  });
}
