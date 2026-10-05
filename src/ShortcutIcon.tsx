import { useState } from 'react';

export function ShortcutIcon({ url, title }: { url: string; title: string }) {
  let src: string | undefined;
  try {
    const site = new URL(url);
    if (site.protocol === 'https:') {
      src = new URL('/favicon.ico', site.origin).href;
      // JD declares this dog icon in its own HTML. The root file is an old
      // JD logo on www.jd.com and an HTML page on home.jd.com.
      if (site.hostname === 'jd.com' || site.hostname.endsWith('.jd.com')) {
        src = 'https://storage.360buyimg.com/retail-mall/mall-common-component/favicon.ico';
      }
    }
  } catch { /* An invalid or non-HTTPS address uses the name instead. */ }
  // Remount on URL edits so load/error state cannot belong to the previous site.
  return <IconImage key={url} src={src} title={title} />;
}

function IconImage({ src, title }: { src?: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = Array.from(title.trim())[0]?.toLocaleUpperCase() ?? '?';
  return <span className="site-icon" aria-hidden="true">
    {!loaded && <span className="site-icon-fallback">{initial}</span>}
    {src && !failed && <img src={src} alt="" width={28} height={28}
      className={loaded ? 'site-icon-image is-loaded' : 'site-icon-image'}
      referrerPolicy="no-referrer" draggable={false} decoding="async"
      onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailed(true); }} />}
  </span>;
}
