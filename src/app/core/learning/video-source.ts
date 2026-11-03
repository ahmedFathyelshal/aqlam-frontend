export type VideoSource =
  | { embedUrl: string; kind: 'vimeo' | 'youtube' }
  | { kind: 'file'; url: string }
  | { kind: 'unknown'; url: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Recognises YouTube, Vimeo and direct video files. Embeds enable the providers' postMessage APIs so the
 * player can measure watching. Anything else is shown as a plain link (never embedded blindly).
 */
export function parseVideoSource(url: string | null | undefined, origin = ''): VideoSource | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { kind: 'unknown', url };
  }

  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  const youtubeId =
    host === 'youtu.be'
      ? parsed.pathname.slice(1)
      : host === 'youtube.com' || host === 'youtube-nocookie.com'
        ? (parsed.searchParams.get('v') ?? parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ?? '')
        : '';

  if (YOUTUBE_ID.test(youtubeId)) {
    const params = new URLSearchParams({ enablejsapi: '1', rel: '0', ...(origin ? { origin } : {}) });
    return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}` };
  }

  const vimeoId = host === 'vimeo.com' ? parsed.pathname.match(/^\/(\d+)/)?.[1] : host === 'player.vimeo.com' ? parsed.pathname.match(/^\/video\/(\d+)/)?.[1] : undefined;
  if (vimeoId) {
    return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoId}?api=1` };
  }

  if (parsed.protocol === 'https:' && /\.(mp4|webm|ogg)$/i.test(parsed.pathname)) {
    return { kind: 'file', url };
  }

  return { kind: 'unknown', url };
}
