// Curated Google Fonts registry for the title overlay. Loaded via @remotion/google-fonts
// so the exact same font renders in the Player preview AND the actual Lambda render
// (Chromium on Lambda has no system fonts installed — this is required, not cosmetic).

import * as Roboto from "@remotion/google-fonts/Roboto";
import * as Poppins from "@remotion/google-fonts/Poppins";
import * as Montserrat from "@remotion/google-fonts/Montserrat";
import * as Manrope from "@remotion/google-fonts/Manrope";
import * as WorkSans from "@remotion/google-fonts/WorkSans";
import * as Outfit from "@remotion/google-fonts/Outfit";
import * as DMSans from "@remotion/google-fonts/DMSans";
import * as Sora from "@remotion/google-fonts/Sora";
import * as Urbanist from "@remotion/google-fonts/Urbanist";
import * as Inter from "@remotion/google-fonts/Inter";

import * as PlayfairDisplay from "@remotion/google-fonts/PlayfairDisplay";
import * as Merriweather from "@remotion/google-fonts/Merriweather";
import * as Lora from "@remotion/google-fonts/Lora";
import * as PTSerif from "@remotion/google-fonts/PTSerif";
import * as Cormorant from "@remotion/google-fonts/Cormorant";
import * as LibreBaskerville from "@remotion/google-fonts/LibreBaskerville";
import * as CrimsonText from "@remotion/google-fonts/CrimsonText";
import * as DMSerifDisplay from "@remotion/google-fonts/DMSerifDisplay";

import * as DancingScript from "@remotion/google-fonts/DancingScript";
import * as Pacifico from "@remotion/google-fonts/Pacifico";
import * as GreatVibes from "@remotion/google-fonts/GreatVibes";
import * as Satisfy from "@remotion/google-fonts/Satisfy";
import * as Caveat from "@remotion/google-fonts/Caveat";
import * as IndieFlower from "@remotion/google-fonts/IndieFlower";
import * as ShadowsIntoLight from "@remotion/google-fonts/ShadowsIntoLight";
import * as Kalam from "@remotion/google-fonts/Kalam";

import * as BebasNeue from "@remotion/google-fonts/BebasNeue";
import * as LuckiestGuy from "@remotion/google-fonts/LuckiestGuy";
import * as Bangers from "@remotion/google-fonts/Bangers";
import * as Fredoka from "@remotion/google-fonts/Fredoka";
import * as Bungee from "@remotion/google-fonts/Bungee";
import * as Righteous from "@remotion/google-fonts/Righteous";
import * as PermanentMarker from "@remotion/google-fonts/PermanentMarker";
import * as Chewy from "@remotion/google-fonts/Chewy";

import * as JetBrainsMono from "@remotion/google-fonts/JetBrainsMono";
import * as SpaceMono from "@remotion/google-fonts/SpaceMono";
import * as Anton from "@remotion/google-fonts/Anton";
import * as Oswald from "@remotion/google-fonts/Oswald";

export type FontCategory = "sans-serif" | "serif" | "handwriting" | "display" | "monospace";

export interface FontDefinition {
  id: string;
  label: string;
  category: FontCategory;
  cssFallback: string;
  loadFont: () => { fontFamily: string; waitUntilDone: () => Promise<undefined> };
}

export const FONT_REGISTRY: FontDefinition[] = [
  // Sans Serif
  { id: "inter", label: "Inter", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Inter.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "roboto", label: "Roboto", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Roboto.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "poppins", label: "Poppins", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Poppins.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "montserrat", label: "Montserrat", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Montserrat.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "manrope", label: "Manrope", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Manrope.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "work-sans", label: "Work Sans", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => WorkSans.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "outfit", label: "Outfit", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Outfit.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "dm-sans", label: "DM Sans", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => DMSans.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "sora", label: "Sora", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Sora.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "urbanist", label: "Urbanist", category: "sans-serif", cssFallback: "sans-serif", loadFont: () => Urbanist.loadFont(undefined, { subsets: ["latin"] }) },

  // Serif
  { id: "playfair-display", label: "Playfair Display", category: "serif", cssFallback: "serif", loadFont: () => PlayfairDisplay.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "merriweather", label: "Merriweather", category: "serif", cssFallback: "serif", loadFont: () => Merriweather.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "lora", label: "Lora", category: "serif", cssFallback: "serif", loadFont: () => Lora.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "pt-serif", label: "PT Serif", category: "serif", cssFallback: "serif", loadFont: () => PTSerif.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "cormorant", label: "Cormorant", category: "serif", cssFallback: "serif", loadFont: () => Cormorant.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "libre-baskerville", label: "Libre Baskerville", category: "serif", cssFallback: "serif", loadFont: () => LibreBaskerville.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "crimson-text", label: "Crimson Text", category: "serif", cssFallback: "serif", loadFont: () => CrimsonText.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "dm-serif-display", label: "DM Serif Display", category: "serif", cssFallback: "serif", loadFont: () => DMSerifDisplay.loadFont(undefined, { subsets: ["latin"] }) },

  // Handwriting / Script
  { id: "dancing-script", label: "Dancing Script", category: "handwriting", cssFallback: "cursive", loadFont: () => DancingScript.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "pacifico", label: "Pacifico", category: "handwriting", cssFallback: "cursive", loadFont: () => Pacifico.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "great-vibes", label: "Great Vibes", category: "handwriting", cssFallback: "cursive", loadFont: () => GreatVibes.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "satisfy", label: "Satisfy", category: "handwriting", cssFallback: "cursive", loadFont: () => Satisfy.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "caveat", label: "Caveat", category: "handwriting", cssFallback: "cursive", loadFont: () => Caveat.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "indie-flower", label: "Indie Flower", category: "handwriting", cssFallback: "cursive", loadFont: () => IndieFlower.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "shadows-into-light", label: "Shadows Into Light", category: "handwriting", cssFallback: "cursive", loadFont: () => ShadowsIntoLight.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "kalam", label: "Kalam", category: "handwriting", cssFallback: "cursive", loadFont: () => Kalam.loadFont(undefined, { subsets: ["latin"] }) },

  // Cartoon / Comic / Display
  { id: "bebas-neue", label: "Bebas Neue", category: "display", cssFallback: "sans-serif", loadFont: () => BebasNeue.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "luckiest-guy", label: "Luckiest Guy", category: "display", cssFallback: "cursive", loadFont: () => LuckiestGuy.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "bangers", label: "Bangers", category: "display", cssFallback: "cursive", loadFont: () => Bangers.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "fredoka", label: "Fredoka", category: "display", cssFallback: "cursive", loadFont: () => Fredoka.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "bungee", label: "Bungee", category: "display", cssFallback: "cursive", loadFont: () => Bungee.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "righteous", label: "Righteous", category: "display", cssFallback: "cursive", loadFont: () => Righteous.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "permanent-marker", label: "Permanent Marker", category: "display", cssFallback: "cursive", loadFont: () => PermanentMarker.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "chewy", label: "Chewy", category: "display", cssFallback: "cursive", loadFont: () => Chewy.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "anton", label: "Anton", category: "display", cssFallback: "sans-serif", loadFont: () => Anton.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "oswald", label: "Oswald", category: "display", cssFallback: "sans-serif", loadFont: () => Oswald.loadFont(undefined, { subsets: ["latin"] }) },

  // Monospace
  { id: "jetbrains-mono", label: "JetBrains Mono", category: "monospace", cssFallback: "monospace", loadFont: () => JetBrainsMono.loadFont(undefined, { subsets: ["latin"] }) },
  { id: "space-mono", label: "Space Mono", category: "monospace", cssFallback: "monospace", loadFont: () => SpaceMono.loadFont(undefined, { subsets: ["latin"] }) },
];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  "sans-serif": "Sans Serif",
  serif: "Serif",
  handwriting: "Handwriting",
  display: "Cartoon / Comic / Display",
  monospace: "Monospace",
};

const FONT_BY_ID: Record<string, FontDefinition> = Object.fromEntries(FONT_REGISTRY.map((f) => [f.id, f]));

export function getFontDefinition(id: string | undefined): FontDefinition {
  return (id && FONT_BY_ID[id]) || FONT_BY_ID["inter"];
}

// Resolves the CSS font-family string for a given font id, loading it via
// @remotion/google-fonts (this both loads the font AND makes Remotion wait for it
// before capturing frames — required for correct rendering, not just preview).
export function resolveTitleFontFamily(id: string | undefined): string {
  const def = getFontDefinition(id);
  const { fontFamily } = def.loadFont();
  return `"${fontFamily}", ${def.cssFallback}`;
}
