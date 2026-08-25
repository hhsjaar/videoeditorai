import { NextRequest, NextResponse } from "next/server";
import { getJob, getFreshDownloadUrl } from "@/lib/renderQueue";

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

  if (job.status !== "done") {
    return NextResponse.json(
      { error: `Job is not ready (status: ${job.status})` },
      { status: 409 }
    );
  }

  // Output lives on S3 (Remotion Lambda render). Always regenerate a fresh presigned
  // URL — the cached one may have expired for jobs revisited from render history.
  const url = await getFreshDownloadUrl(jobId);
  if (!url) {
    return NextResponse.json({ error: "Output tidak ditemukan di S3." }, { status: 404 });
  }

  // The filename/Content-Disposition is already set via downloadBehavior at render time.
  return NextResponse.redirect(url, { status: 302 });
}
