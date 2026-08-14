import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const BGM_TRACKS = [
  {
    id: "bsl1",
    title: "BGM 1 - Modern Chill Vibe (Burjo Level Up)",
    category: "F&B / Modern Cafe & Chill",
    file: "bsl1.mp3",
    url: "/bgm/bsl1.mp3",
    keywords: ["kopi", "cafe", "kafe", "nongkrong", "aesthetic", "santai", "vlog", "burjo", "makanan"],
  },
  {
    id: "bsl2",
    title: "BGM 2 - Upbeat Culinary Beat",
    category: "F&B / Bistro & Fast Food",
    file: "bsl2.mp3",
    url: "/bgm/bsl2.mp3",
    keywords: ["makanan", "kuliner", "resto", "bistro", "menu", "masak", "makan", "upbeat", "ramai"],
  },
  {
    id: "bsl3",
    title: "BGM 3 - Aesthetic Cafe Mood",
    category: "F&B / Coffee & Chillout",
    file: "bsl3.mp3",
    url: "/bgm/bsl3.mp3",
    keywords: ["latte", "coffee", "roastery", "aesthetic", "chill", "santai", "warm", "makan siang"],
  },
  {
    id: "bsl4",
    title: "BGM 4 - Premium Gourmet Vibe",
    category: "F&B / Gourmet & Fine Dining",
    file: "bsl4.mp3",
    url: "/bgm/bsl4.mp3",
    keywords: ["gourmet", "fine dining", "premium", "mewah", "steak", "otentik", "brand", "eksklusif"],
  },
  {
    id: "bsl5",
    title: "BGM 5 - Trendy Commercial Anthem",
    category: "Brand Ads / Commercial Anthem",
    file: "bsl5.mp3",
    url: "/bgm/bsl5.mp3",
    keywords: ["brand", "iklan", "commercial", "moderen", "launching", "opening", "outlet", "franchise"],
  },
  {
    id: "bsl6",
    title: "BGM 6 - Sweet Bakery & Dessert",
    category: "F&B / Bakery & Desserts",
    file: "bsl6.mp3",
    url: "/bgm/bsl6.mp3",
    keywords: ["roti", "bakery", "cake", "kue", "dessert", "manis", "cokelat", "pastry", "croissant"],
  },
  {
    id: "bsl7",
    title: "BGM 7 - Refreshing Summer Beverage",
    category: "F&B / Drinks & Beverage",
    file: "bsl7.mp3",
    url: "/bgm/bsl7.mp3",
    keywords: ["minuman", "segar", "boba", "tea", "es kopi", "juice", "mocktail", "summer", "dingin"],
  },
  {
    id: "bsl8",
    title: "BGM 8 - Viral Foodie Beat",
    category: "F&B / Viral Street Food",
    file: "bsl8.mp3",
    url: "/bgm/bsl8.mp3",
    keywords: ["street food", "jajanan", "viral", "pedas", "mukbang", "promo", "diskon", "fast"],
  },
  {
    id: "bsl9",
    title: "BGM 9 - Stylish Bistro Lounge",
    category: "F&B / Bar & Lounge",
    file: "bsl9.mp3",
    url: "/bgm/bsl9.mp3",
    keywords: ["bar", "lounge", "malam", "cocktail", "chillout", "modern bar", "hangout", "lounge"],
  },
  {
    id: "bsl10",
    title: "BGM 10 - Modern Brand Commercial",
    category: "Brand & Promotion",
    file: "bsl10.mp3",
    url: "/bgm/bsl10.mp3",
    keywords: ["brand", "promosi", "outlet", "level up", "makanan", "minuman", "rasa", "menu favorit"],
  },
];

export async function GET() {
  return NextResponse.json({ tracks: BGM_TRACKS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const scriptText = (body.scriptText || body.script || body.text || "").trim();

    const activeApiKey = body.apiKey || process.env.GEMINI_API_KEY;

    let selectedTrack = BGM_TRACKS[0];
    let reasoning = "Dipilih berdasarkan analisis suasana brand naskah F&B.";

    if (activeApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: activeApiKey });
        const trackOptionsPrompt = BGM_TRACKS.map((t) => `- "${t.id}": ${t.title} (${t.category})`).join("\n");

        const prompt = `Anda adalah seorang Audio Branding & Music Director profesional untuk brand Food & Beverage (F&B) dan Iklan Komersial Moderen.
Analisis naskah promosi brand berikut dan pilih 1 musik latar (BGM) komersial yang paling pas dari 10 opsi berikut:

${trackOptionsPrompt}

Naskah Video:
"${scriptText}"

Berikan respon berformat JSON murni tanpa markdown triple backticks dengan struktur persis seperti berikut:
{
  "selectedTrackId": "bsl1",
  "reasoning": "Alasan singkat 1 kalimat mengapa lagu BGM ini paling cocok dengan naskah.",
  "recommendedVolume": 0.2
}`;

        const candidateModels = ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
        let response: any = null;
        let lastErr: any = null;

        for (const mName of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: mName,
              contents: prompt,
            });
            if (response && response.text) break;
          } catch (err) {
            lastErr = err;
          }
        }

        if (!response) throw lastErr || new Error("Gagal memanggil model Gemini.");

        const textRes = response.text || "";
        const cleanedJson = textRes.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleanedJson);

        const found = BGM_TRACKS.find((t) => t.id === parsed.selectedTrackId);
        if (found) selectedTrack = found;
        if (parsed.reasoning) reasoning = parsed.reasoning;
      } catch (aiErr) {
        console.warn("AI BGM selection failed, falling back to keyword match:", aiErr);
        const lowerScript = scriptText.toLowerCase();
        for (const track of BGM_TRACKS) {
          if (track.keywords.some((kw) => lowerScript.includes(kw))) {
            selectedTrack = track;
            reasoning = `Dicocokkan berdasarkan kata kunci naskah F&B (${track.title}).`;
            break;
          }
        }
      }
    }

    return NextResponse.json({
      track: selectedTrack,
      reasoning,
      recommendedVolume: 0.2,
    });
  } catch (error: any) {
    console.error("Error in select-bgm route:", error);
    return NextResponse.json({ error: error.message || "Gagal memilih BGM." }, { status: 500 });
  }
}
