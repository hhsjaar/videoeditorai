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

    const activeApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const activeStyle = styleInstruction || DEFAULT_STYLE_INSTRUCTION;

    if (!activeApiKey) {
      console.warn("GEMINI_API_KEY is missing on server environment. Falling back to Google Translate TTS.");
    } else {
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
      } catch (geminiErr: any) {
        console.error("Gemini Zephyr TTS error on server:", geminiErr?.message || geminiErr);
      }
    }

    // Fallback TTS generator if no key or Gemini error
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
      if ((current + sentence).length > 150) {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    const audioBuffers: Buffer[] = [];
    const lang = "id";

    for (const chunk of chunks) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
        chunk
      )}&tl=${lang}&client=tw-ob`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      if (res.ok) {
        const buf = await res.arrayBuffer();
        audioBuffers.push(Buffer.from(buf));
      }
    }

    if (audioBuffers.length === 0) {
      return NextResponse.json(
        { error: "Gagal membuat audio Voice Over." },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.concat(audioBuffers);

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mp3",
        "Content-Length": audioBuffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error generating speech:", error);
    return NextResponse.json(
      { error: error.message || "Gagal membuat Voice Over audio." },
      { status: 500 }
    );
  }
}
