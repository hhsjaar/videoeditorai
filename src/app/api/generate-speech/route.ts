import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { writeFile, unlink, readFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const DEFAULT_STYLE_INSTRUCTION = `A friendly and professional real estate presenter is filming a cinematic promotional video while showcasing a featured property. The visuals capture the property, surrounding environment, access roads, exterior highlights, and nearby neighborhood with smooth dynamic movement and polished cinematography. The setting feels modern, bright, and premium, creating an engaging yet balanced atmosphere suitable for short-form social media property content. The video should feel polished and visually appealing, with a clean commercial aesthetic and steady, natural pacing.

The speaker is a knowledgeable and approachable property marketing expert introducing a featured property opportunity to potential buyers. They speak in a confident, friendly, and conversational tone with moderate pacing—clear, engaging, and natural without sounding overly dramatic or overly excited. The delivery should feel persuasive and professional, like an experienced presenter casually but confidently showcasing a quality property in a polished promotional video.`;

import fs from "fs";

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

      const prompt = `${activeStyle}\n\nBacakan naskah berikut ini dengan alami, jelas, dan percaya diri:\n"${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: prompt,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Zephyr",
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

          return new NextResponse(wavBuffer, {
            headers: {
              "Content-Type": "audio/wav",
              "Content-Length": wavBuffer.length.toString(),
              "X-TTS-Engine": "Gemini-Zephyr",
            },
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
