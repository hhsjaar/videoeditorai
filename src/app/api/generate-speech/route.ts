import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DEFAULT_STYLE_INSTRUCTION = `Anda adalah seorang presenter dan voice over profesional Indonesia yang ramah, komunikatif, dan penuh percaya diri. Ucapkan naskah Bahasa Indonesia berikut ini dengan intonasi yang alami, nada bicara yang hangat dan segar, artikulasi jernih, serta tempo bicara yang pas seperti iklan komersial modern.`;

import fs from "fs";

// Count syllables per word (vowel cluster count) for Indonesian/English
function countSyllables(word: string): number {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
  const vowels = cleaned.match(/[aeiouáéíóúàèìòùäëïöü]+/g);
  return Math.max(1, vowels ? vowels.length : 1);
}

// Voice Activity Detection: scan PCM buffer to find actual speech start & end time
function detectSpeechBoundaries(
  pcmBuffer: Buffer,
  sampleRate = 24000
): { speechStartSec: number; speechEndSec: number } {
  const bytesPerSample = 2;
  const numSamples = Math.floor(pcmBuffer.length / bytesPerSample);
  const windowSamples = Math.floor(sampleRate * 0.02);
  const energyThreshold = 1000;

  let speechStartSample = 0;
  let speechEndSample = numSamples;

  for (let i = 0; i < numSamples - windowSamples; i += windowSamples) {
    let sumSq = 0;
    for (let j = 0; j < windowSamples && (i + j) < numSamples; j++) {
      const idx = (i + j) * bytesPerSample;
      if (idx + 1 < pcmBuffer.length) {
        const sample = pcmBuffer.readInt16LE(idx);
        sumSq += sample * sample;
      }
    }
    if (Math.sqrt(sumSq / windowSamples) > energyThreshold) {
      speechStartSample = Math.max(0, i - windowSamples);
      break;
    }
  }

  for (let i = numSamples - windowSamples; i > speechStartSample; i -= windowSamples) {
    let sumSq = 0;
    for (let j = 0; j < windowSamples && (i + j) < numSamples; j++) {
      const idx = (i + j) * bytesPerSample;
      if (idx + 1 < pcmBuffer.length) {
        const sample = pcmBuffer.readInt16LE(idx);
        sumSq += sample * sample;
      }
    }
    if (Math.sqrt(sumSq / windowSamples) > energyThreshold) {
      speechEndSample = Math.min(numSamples, i + windowSamples * 2);
      break;
    }
  }

  return {
    speechStartSec: parseFloat((speechStartSample / sampleRate).toFixed(3)),
    speechEndSec: parseFloat((speechEndSample / sampleRate).toFixed(3)),
  };
}

// Detect all silence regions (gaps > minSilenceSec) within [speechStartSec, speechEndSec]
// Returns speech segments (NON-silent periods) — where actual speaking happens
function detectSpeechSegments(
  pcmBuffer: Buffer,
  speechStartSec: number,
  speechEndSec: number,
  sampleRate = 24000
): Array<{ startSec: number; endSec: number }> {
  const bytesPerSample = 2;
  const numSamples = Math.floor(pcmBuffer.length / bytesPerSample);
  const windowSamples = Math.floor(sampleRate * 0.01); // 10ms window for fine detection
  const energyThreshold = 600;   // lower than VAD threshold to catch soft speech too
  const minSilenceSamples = Math.floor(0.10 * sampleRate); // ignore gaps < 100ms (breathing)

  const startSample = Math.floor(speechStartSec * sampleRate);
  const endSample = Math.min(numSamples, Math.floor(speechEndSec * sampleRate));

  // Compute energy per window
  type EnergyWindow = { startSample: number; rms: number };
  const windows: EnergyWindow[] = [];
  for (let i = startSample; i < endSample; i += windowSamples) {
    let sumSq = 0;
    let count = 0;
    for (let j = 0; j < windowSamples && (i + j) < endSample; j++) {
      const idx = (i + j) * bytesPerSample;
      if (idx + 1 < pcmBuffer.length) {
        const sample = pcmBuffer.readInt16LE(idx);
        sumSq += sample * sample;
        count++;
      }
    }
    windows.push({ startSample: i, rms: count > 0 ? Math.sqrt(sumSq / count) : 0 });
  }

  // Find silence gaps: contiguous windows below threshold
  const silenceGaps: Array<{ startSec: number; endSec: number }> = [];
  let silenceStart = -1;

  for (let wi = 0; wi < windows.length; wi++) {
    const w = windows[wi];
    if (w.rms < energyThreshold) {
      if (silenceStart < 0) silenceStart = w.startSample;
    } else {
      if (silenceStart >= 0) {
        const silenceDur = w.startSample - silenceStart;
        if (silenceDur >= minSilenceSamples) {
          silenceGaps.push({
            startSec: parseFloat((silenceStart / sampleRate).toFixed(3)),
            endSec: parseFloat((w.startSample / sampleRate).toFixed(3)),
          });
        }
        silenceStart = -1;
      }
    }
  }
  if (silenceStart >= 0) {
    const silenceDur = endSample - silenceStart;
    if (silenceDur >= minSilenceSamples) {
      silenceGaps.push({
        startSec: parseFloat((silenceStart / sampleRate).toFixed(3)),
        endSec: parseFloat((endSample / sampleRate).toFixed(3)),
      });
    }
  }

  // Invert silence gaps → speech segments
  const speechSegs: Array<{ startSec: number; endSec: number }> = [];
  let segStart = speechStartSec;

  for (const gap of silenceGaps) {
    if (gap.startSec > segStart + 0.01) {
      speechSegs.push({ startSec: segStart, endSec: gap.startSec });
    }
    segStart = gap.endSec;
  }
  if (segStart < speechEndSec - 0.01) {
    speechSegs.push({ startSec: segStart, endSec: speechEndSec });
  }

  // Fallback: if no segments found, use entire speech window
  if (speechSegs.length === 0) {
    speechSegs.push({ startSec: speechStartSec, endSec: speechEndSec });
  }

  return speechSegs;
}

// Convert "speech-only time" (time excluding all silence gaps) → wall-clock time
function speechOnlyToWallClock(
  speechOnlyTime: number,
  speechSegments: Array<{ startSec: number; endSec: number }>
): number {
  let speechAccum = 0;
  for (const seg of speechSegments) {
    const segDur = seg.endSec - seg.startSec;
    if (speechOnlyTime <= speechAccum + segDur) {
      return seg.startSec + (speechOnlyTime - speechAccum);
    }
    speechAccum += segDur;
  }
  const lastSeg = speechSegments[speechSegments.length - 1];
  return lastSeg ? lastSeg.endSec : 0;
}

// Compute word-level timestamps anchored to real speech segments from PCM analysis.
// Words are distributed proportionally by syllable count ONLY within actual speech periods.
// Silence gaps detected from the audio are preserved — subtitle never shows during true silence.
function computeWordTimings(
  text: string,
  totalDurationSec: number,
  speechSegments: Array<{ startSec: number; endSec: number }>
): Array<{ word: string; start: number; end: number }> {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  // Total actual speaking time (sum of speech segment durations)
  const totalSpeechTime = speechSegments.reduce((a, s) => a + (s.endSec - s.startSec), 0);
  if (totalSpeechTime <= 0) return [];

  // Compute syllable weights for each word
  const syllables = rawWords.map(w => {
    const clean = w.replace(/[.,!?;:"""''()\[\]]/g, "");
    return Math.max(1, countSyllables(clean) + clean.length * 0.1);
  });
  const totalSyllables = syllables.reduce((a, b) => a + b, 0) || 1;

  // Map each word to wall-clock time via speech-only cumulative offset
  const wordTimings: Array<{ word: string; start: number; end: number }> = [];
  let sylAccum = 0;

  for (let i = 0; i < rawWords.length; i++) {
    const speechOnlyStart = (sylAccum / totalSyllables) * totalSpeechTime;
    const speechOnlyEnd = ((sylAccum + syllables[i]) / totalSyllables) * totalSpeechTime;

    const wallStart = parseFloat(speechOnlyToWallClock(speechOnlyStart, speechSegments).toFixed(3));
    const wallEnd = parseFloat(Math.min(totalDurationSec, speechOnlyToWallClock(speechOnlyEnd, speechSegments)).toFixed(3));

    wordTimings.push({ word: rawWords[i], start: wallStart, end: wallEnd });
    sylAccum += syllables[i];
  }

  return wordTimings;
}


// === PRIMARY: Gemini Audio Transcription for Accurate Word Timestamps ===
// Send the generated TTS WAV back to Gemini Flash with the source text.
// Gemini will listen to the audio and report when each word was spoken.
// This "forced alignment" approach is far more accurate than syllable estimation.
async function getWordTimestampsViaTranscription(
  wavBase64: string,
  text: string,
  audioDurationSec: number,
  apiKey: string
): Promise<Array<{ word: string; start: number; end: number }> | null> {
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const words = text.trim().split(/\s+/).filter(Boolean);
    const wordList = words.map((w, i) => `${i + 1}. ${w}`).join("\n");

    const prompt = `You are an audio forced-alignment tool. Listen to this Indonesian TTS audio carefully.

The audio contains speech reading these exact words (in order):
${wordList}

Total audio duration: ${audioDurationSec.toFixed(2)} seconds.

Task: For each word number listed above, identify its start and end time in the audio.
Output ONLY a JSON array. No other text. Example format:
[{"word":"Selamat","start":0.18,"end":0.52},{"word":"datang","start":0.52,"end":0.92}]

Requirements:
- Include ALL ${words.length} words in the exact order listed
- start and end are in seconds (float, 2 decimal places)
- Timestamps must be within 0.00 to ${audioDurationSec.toFixed(2)}
- Words must be exactly as listed above (same spelling/capitalization)
- Output the complete JSON array starting with [ and ending with ]`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: { temperature: 0 },
    });

    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Extract JSON array from response (might have surrounding text)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("[generate-speech] Transcription: no JSON array found in response");
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("[generate-speech] Transcription: JSON parse failed");
      return null;
    }

    if (!Array.isArray(parsed)) return null;

    const timings: Array<{ word: string; start: number; end: number }> = [];
    for (const item of parsed as Record<string, unknown>[]) {
      const word = String(item.word || "").trim();
      const start = parseFloat(String(item.start));
      const end = parseFloat(String(item.end));
      if (word && !isNaN(start) && !isNaN(end) && start >= 0 && end > start && end <= audioDurationSec + 0.5) {
        timings.push({
          word,
          start: parseFloat(start.toFixed(3)),
          end: parseFloat(Math.min(audioDurationSec, end).toFixed(3)),
        });
      }
    }

    // Validate: need at least 70% of expected words
    if (timings.length < words.length * 0.7) {
      console.warn(`[generate-speech] Transcription: ${timings.length}/${words.length} words — insufficient, using VAD fallback`);
      return null;
    }

    // Sanity check: timestamps must be monotonically increasing
    for (let i = 1; i < timings.length; i++) {
      if (timings[i].start < timings[i - 1].start) {
        console.warn("[generate-speech] Transcription: non-monotonic timestamps, using VAD fallback");
        return null;
      }
    }

    console.log(`[generate-speech] Transcription SUCCESS: ${timings.length}/${words.length} words aligned`);
    return timings;
  } catch (e: any) {
    console.warn("[generate-speech] Transcription failed:", e?.message || e, "— using VAD fallback");
    return null;
  }
}


function getApiKey(passedKey?: string): string {
  const clean = (val?: string) => (val || "").replace(/^["']|["']$/g, "").replace(/["']/g, "").trim();

  if (passedKey && clean(passedKey).length > 5) return clean(passedKey);
  if (process.env.GEMINI_API_KEY && clean(process.env.GEMINI_API_KEY).length > 5) return clean(process.env.GEMINI_API_KEY);
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY && clean(process.env.NEXT_PUBLIC_GEMINI_API_KEY).length > 5) return clean(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

  try {
    const p1 = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(p1)) {
      const content = fs.readFileSync(p1, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("GEMINI_API_KEY=")) {
          const val = clean(trimmed.substring("GEMINI_API_KEY=".length));
          if (val.length > 5) return val;
        }
      }
    }
  } catch (e) {}

  try {
    const p2 = path.join(process.cwd(), ".env");
    if (fs.existsSync(p2)) {
      const content = fs.readFileSync(p2, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("GEMINI_API_KEY=")) {
          const val = clean(trimmed.substring("GEMINI_API_KEY=".length));
          if (val.length > 5) return val;
        }
      }
    }
  } catch (e) {}

  return "";
}

function createWavHeader(dataLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

export async function POST(req: NextRequest) {
  try {
    const { text, apiKey, voiceName = "Zephyr", styleInstruction } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Teks Voice Over tidak boleh kosong." },
        { status: 400 }
      );
    }

    const activeApiKey = getApiKey(apiKey);
    const activeStyle = styleInstruction || DEFAULT_STYLE_INSTRUCTION;

    if (!activeApiKey) {
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY tidak ditemukan di .env.local VPS server. Jalankan perintah di VPS: echo 'GEMINI_API_KEY=\"AQ.Ab8RN6JEazxVo...\"' > .env.local lalu pm2 restart all",
        },
        { status: 400 }
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey: activeApiKey });
      const selectedVoiceName = voiceName || "Zephyr";
      const prompt = `${activeStyle}\n\nBacakan naskah berikut ini dengan alami, jelas, dan percaya diri:\n"${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: prompt,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoiceName,
              },
            },
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const pcmBuffer = Buffer.from(part.inlineData.data, "base64");
          const wavHeader = createWavHeader(pcmBuffer.length, 24000, 1, 16);
          const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

          // Calculate exact audio duration from PCM samples
          // Gemini TTS: 24000 Hz, 16-bit mono = 2 bytes/sample
          const audioDurationSec = pcmBuffer.length / (24000 * 2);

          // Detect actual speech start/end for boundary detection
          const { speechStartSec, speechEndSec } = detectSpeechBoundaries(pcmBuffer);

          // PRIMARY: Ask Gemini to transcribe the audio and return word-level timestamps.
          // This is forced alignment — far more accurate than syllable estimation.
          // Falls back to VAD-based estimation if transcription fails.
          const audioBase64 = wavBuffer.toString("base64");
          let wordTimings = await getWordTimestampsViaTranscription(
            audioBase64, text, audioDurationSec, apiKey
          );

          if (!wordTimings) {
            // FALLBACK: VAD silence segment estimation
            const speechSegments = detectSpeechSegments(pcmBuffer, speechStartSec, speechEndSec);
            console.log(`[generate-speech] VAD fallback: totalDur=${audioDurationSec.toFixed(2)}s, segments=${speechSegments.length}`);
            wordTimings = computeWordTimings(text, audioDurationSec, speechSegments);
          }

          // Return JSON with audio base64 + word timings to avoid HTTP header size limits
          return NextResponse.json({
            audioBase64,
            audioMime: "audio/wav",
            audioDurationSec,
            speechStartSec,
            speechEndSec,
            wordTimings,
            engine: `Gemini-${selectedVoiceName}`,
          });
        }
      }

      return NextResponse.json(
        { error: "Gemini API tidak mengembalikan data audio Zephyr. Coba lagi dalam beberapa saat." },
        { status: 500 }
      );
    } catch (geminiErr: any) {
      console.error("Gemini Zephyr TTS error on server:", geminiErr?.message || geminiErr);
      return NextResponse.json(
        {
          error: `Gagal membuat Suara Zephyr: ${
            geminiErr?.message || "Gemini API Error"
          }. Pastikan API Key Gemini yang Anda gunakan valid (diawali 'AIzaSy...').`,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error generating speech:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat Voice Over audio." },
      { status: 500 }
    );
  }
}
