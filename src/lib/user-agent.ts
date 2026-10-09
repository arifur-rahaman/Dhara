/**
 * A short, readable device name from a browser's user agent, for the Settings device list
 * ("Chrome · Android"). Brand names are not translated. Unknown parts are left out.
 */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPod/.test(ua)
      ? 'iPhone'
      : /iPad/.test(ua)
        ? 'iPad'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'ChromeOS'
              : /Linux/.test(ua)
                ? 'Linux'
                : null;
  // Order matters: Edge, Opera and Samsung Internet also say "Chrome"; Chrome also says "Safari".
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
