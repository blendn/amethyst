import { useEffect, useMemo, useState } from "react";

export function EntryIcon({ name, url }: { name: string; url: string }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const faviconSources = useMemo(() => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
        return [];
      return [
        new URL("/favicon.ico", parsed.origin).toString(),
        `https://icons.duckduckgo.com/ip3/${encodeURIComponent(parsed.hostname)}.ico`,
      ];
    } catch {
      return [];
    }
  }, [url]);

  useEffect(() => setSourceIndex(0), [faviconSources]);

  const favicon = faviconSources[sourceIndex];

  return (
    <div className="entry-icon" aria-hidden="true">
      {favicon ? (
        <img
          src={favicon}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
