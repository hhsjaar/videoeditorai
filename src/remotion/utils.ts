import { staticFile } from "remotion";

export const resolveMediaSrc = (src: string | undefined): string | undefined => {
  if (!src) return undefined;
  if (
    src.startsWith("http://") ||
    src.startsWith("https://") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  ) {
    return src;
  }
  return staticFile(src);
};
