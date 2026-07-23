const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidId(id: string | undefined | null): id is string {
  return typeof id === "string" && VIDEO_ID_RE.test(id);
}

function parseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      return null;
    }
  }
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isValidId(trimmed)) return trimmed;

  const url = parseUrl(trimmed);
  if (!url) return null;

  const host = url.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidId(id) ? id : null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const vParam = url.searchParams.get("v");
  if (isValidId(vParam)) return vParam;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && (segments[0] === "shorts" || segments[0] === "embed")) {
    return isValidId(segments[1]) ? segments[1] : null;
  }

  return null;
}
