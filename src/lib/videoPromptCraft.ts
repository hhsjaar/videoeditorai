/**
 * videoPromptCraft.ts — Shared cinematography rules injected into every
 * English visualPrompt-writing system prompt (refine-scenes + image-scenes).
 *
 * Why this exists: dense character/style description alone isn't enough —
 * a prompt like "...gazing out at the horizon packed with advancing enemy
 * troops as the camera dollies forward..." leaves the video model to guess
 * WHERE the troops are relative to where the character is facing, and WHAT
 * the camera move is supposed to reveal. Left ambiguous, models often stage
 * it disconnected (character facing one way, the described crowd already
 * somewhere else) — the emotional beat the prompt was going for falls flat.
 * These rules force staging and camera intent to be spelled out explicitly.
 */
export const CINEMATOGRAPHY_RULES = `- STAGING WAJIB EKSPLISIT DAN TERSAMBUNG: kalau karakter menatap/menghadap sesuatu (ancaman, lawan bicara, objek), elemen itu HARUS disebut berada di ARAH yang sama dengan tatapan/hadapnya — misal bukan "gazing out at the horizon packed with advancing troops" (ambigu, AI video sering salah nebak arah), tapi "he turns to face the eastern ridge, where thousands of advancing enemy troops fill the horizon directly ahead of him". Setiap elemen visual penting (orang, kerumunan, objek kunci) harus punya posisi & arah yang jelas relatif terhadap subjek utama — jangan biarkan video engine menebak sendiri, karena hasilnya sering nggak nyambung (karakter menghadap kanan padahal yang dideskripsikan sudah di depan/kiri).
- CAMERA MOVEMENT WAJIB PUNYA TUJUAN NARATIF, bukan cuma nama gerakan: jangan cuma "the camera dollies forward" — jelaskan APA yang diungkap/ditekankan gerakan itu, misal "the camera dollies forward, starting wide to reveal the overwhelming scale of the advancing horde stretching to the horizon, then settling into a tight push on his face to catch the flicker of doubt beneath his calm expression". Kalau ada beat emosional (ketegangan naik, kesadaran, keputusan), gerakan kamera idealnya menegaskan beat itu (push in = makin intim/tegang, pull out = makin kecil/kewalahan, dst).
- EKSPRESI & BAHASA TUBUH WAJIB SPESIFIK, bukan generik: hindari "stands resolutely" atau "looks worried" polos — sebutkan detail micro-expression/ketegangan tubuh yang mengkomunikasikan emosi baris itu (rahang mengeras, jari mengepal, napas tertahan, sudut mata sedikit basah, dst), disambungkan ke apa yang sedang terjadi di scene itu.`;
