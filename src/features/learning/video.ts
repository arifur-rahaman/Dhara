/**
 * How a module's video is shown. YouTube links play through youtube-nocookie.com; any other https link
 * is treated as a video file. Anything else is not shown.
 */
export function videoEmbed(
  url: string | null,
): { kind: 'youtube'; src: string } | { kind: 'file'; src: string } | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\./, '');
  let youtubeId: string | null = null;
  if (host === 'youtu.be') youtubeId = parsed.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'm.youtube.com') {
    youtubeId =
      parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : (parsed.pathname.match(/^\/embed\/([^/]+)/)?.[1] ?? null);
  }
  if (youtubeId !== null) {
    return /^[\w-]{6,20}$/.test(youtubeId)
      ? { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${youtubeId}` }
      : null;
  }
  return { kind: 'file', src: parsed.toString() };
}
