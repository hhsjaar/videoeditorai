import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import { getVeoJob, OUTPUT_DIR } from "@/lib/veoQueue";
import { getCachedFfmpeg } from "@/lib/renderQueue";

const execAsync = promisify(exec);

export const MERGE_OUTPUT_DIR = path.join(process.cwd(), "data", "veo-merged");

// Stitches multiple already-generated Veo clips (in order) into one downloadable
// file — for "just give me the whole reel" without going through full Studio
// editing. Runs synchronously: concatenating a handful of short clips that
// already exist on disk takes a few seconds, not worth a background job queue.
export async function POST(req: NextRequest) {
  try {
    const { jobIds } = await req.json();
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return NextResponse.json({ error: "Daftar jobId klip kosong." }, { status: 400 });
    }

    const filePaths: string[] = [];
    for (const jobId of jobIds) {
      if (typeof jobId !== "string" || !/^[a-zA-Z0-9-]+$/.test(jobId)) {
        return NextResponse.json({ error: `Job id tidak valid: ${jobId}` }, { status: 400 });
      }
      const job = await getVeoJob(jobId);
      if (!job || job.status !== "done" || !job.videoUrl) {
        return NextResponse.json({ error: `Klip ${jobId} belum selesai digenerate.` }, { status: 400 });
      }
      filePaths.push(path.join(OUTPUT_DIR, `${jobId}.mp4`));
    }

    const ffmpegBin = await getCachedFfmpeg();
    if (!ffmpegBin) {
      return NextResponse.json({ error: "ffmpeg tidak tersedia di server." }, { status: 500 });
    }

    await mkdir(MERGE_OUTPUT_DIR, { recursive: true });
    const mergeId = randomUUID();
    const outPath = path.join(MERGE_OUTPUT_DIR, `${mergeId}.mp4`);
    const listPath = path.join(MERGE_OUTPUT_DIR, `${mergeId}.list.txt`);

    const listContent = filePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
    await writeFile(listPath, listContent, "utf-8");

    try {
      // Fast path: all clips came from the same Veo model/config, so codecs
      // should match — a stream copy avoids any re-encode quality loss.
      await execAsync(
        `"${ffmpegBin}" -y -f concat -safe 0 -i "${listPath}" -c copy -movflags +faststart "${outPath}"`,
        { timeout: 120000 }
      );
    } catch (copyErr: any) {
      console.warn("[video-ai/merge] stream-copy concat failed, re-encoding:", copyErr?.message?.slice(0, 200));
      // Fallback: re-encode through a concat filter — handles clips with
      // slightly mismatched codec params that stream-copy concat rejects.
      const inputArgs = filePaths.map((p) => `-i "${p}"`).join(" ");
      const filterParts = filePaths.map((_, i) => `[${i}:v:0][${i}:a:0]`).join("");
      const filterComplex = `${filterParts}concat=n=${filePaths.length}:v=1:a=1[outv][outa]`;
      await execAsync(
        `"${ffmpegBin}" -y ${inputArgs} -filter_complex "${filterComplex}" -map "[outv]" -map "[outa]" -c:v libx264 -preset veryfast -crf 20 -c:a aac -movflags +faststart "${outPath}"`,
        { timeout: 180000 }
      );
    } finally {
      await rm(listPath, { force: true }).catch(() => {});
    }

    return NextResponse.json({ success: true, mergeId, videoUrl: `/api/video-ai/merged-file/${mergeId}` });
  } catch (error: any) {
    console.error("Error merging Video AI clips:", error);
    return NextResponse.json({ error: error.message || "Gagal menggabungkan video." }, { status: 500 });
  }
}
