import { getSimulationFrameSources, ALLOWED_SIMULATION_DOMAINS } from "./embed";

export const DEFAULT_MEDIA_FRAME_SOURCES = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://drive.google.com",
];

/**
 * Menghasilkan directive frame-src yang memuat domain whitelist simulasi ('self', https://domain, https://*.domain)
 * serta media video yang didukung aplikasi.
 */
export function getFrameSrcSources(extraSources: string[] = []): string[] {
  const sources = new Set<string>([
    ...getSimulationFrameSources(),
    ...DEFAULT_MEDIA_FRAME_SOURCES,
    ...extraSources,
  ]);
  return Array.from(sources);
}

export function getMediaSrcSources(
  storageUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string[] {
  const sources = new Set(["'self'"]);
  if (storageUrl) {
    try {
      sources.add(new URL(storageUrl).origin);
    } catch {
      // Ignore an invalid optional Supabase URL rather than producing an invalid CSP.
    }
  }
  return Array.from(sources);
}

/**
 * Menggabungkan directive frame-src dengan CSP yang sudah ada (jika ada).
 * Mempertahankan directive lain dan menggabungkan token frame-src tanpa menduplikasi.
 */
export function mergeContentSecurityPolicy(existingCsp: string = ""): string {
  const frameSources = getFrameSrcSources();
  const mediaSources = getMediaSrcSources();

  if (!existingCsp.trim()) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      `frame-src ${frameSources.join(" ")}`,
      `media-src ${mediaSources.join(" ")}`,
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");
  }

  const directives = existingCsp
    .split(";")
    .map((d) => d.trim())
    .filter(Boolean);

  let frameSrcFound = false;
  let mediaSrcFound = false;
  const updatedDirectives = directives.map((directive) => {
    if (directive.toLowerCase().startsWith("frame-src")) {
      frameSrcFound = true;
      const existingTokens = directive.split(/\s+/).slice(1);
      const mergedTokens = Array.from(
        new Set([...existingTokens, ...frameSources]),
      );
      return `frame-src ${mergedTokens.join(" ")}`;
    }
    if (directive.toLowerCase().startsWith("media-src")) {
      mediaSrcFound = true;
      const existingTokens = directive.split(/\s+/).slice(1);
      const mergedTokens = Array.from(
        new Set([...existingTokens, ...mediaSources]),
      );
      return `media-src ${mergedTokens.join(" ")}`;
    }
    return directive;
  });

  if (!frameSrcFound) {
    updatedDirectives.push(`frame-src ${frameSources.join(" ")}`);
  }
  if (!mediaSrcFound) {
    updatedDirectives.push(`media-src ${mediaSources.join(" ")}`);
  }

  return updatedDirectives.join("; ");
}

export { ALLOWED_SIMULATION_DOMAINS };
