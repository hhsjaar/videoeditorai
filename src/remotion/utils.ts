import { staticFile } from "remotion";

export const resolveMediaSrc = (src: string | undefined): string | undefined => {
  if (!src) return undefined;
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    src.startsWith("file://") // absolute path — used when bundle is cached (no publicDir per-request)
  ) {
    return src;
  }
  return staticFile(src);
};
