import ogImage from '../../assets/img/sla-building.webp';

// Per-route metadata.
//
// No library: React 19 hoists <title>, <meta> and <link> into <head> from
// wherever they are rendered, and de-duplicates <title> itself, so a page simply
// renders the tags it wants. index.html keeps its own copies as the pre-hydration
// default — what a crawler that does not run scripts will read — and these
// replace them once the app mounts.
//
// Nothing here restates firm content: each page passes what it already has from
// data/, and PageMeta only frames it.

const SITE_NAME = 'SLA Advocates';

// Absolute URLs are required for canonical and og:url. The deployment domain is
// not knowable from the source tree, so it is read from the environment and
// falls back to wherever the page is actually being served — which is correct
// for a client-rendered site, and never a domain that is merely guessed.
// Set VITE_SITE_URL at build time to pin it (e.g. https://www.example.com).
const ORIGIN =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ||
  (typeof window === 'undefined' ? '' : window.location.origin);

export default function PageMeta({
  title,
  description,
  path = '/',
  type = 'website',
  noindex = false,
}) {
  // The home page is the firm's name alone; every other page is scoped by it.
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const url = `${ORIGIN}${path}`;
  const image = `${ORIGIN}${ogImage}`;

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1000" />
      <meta property="og:image:height" content="1000" />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {noindex && <meta name="robots" content="noindex, follow" />}
    </>
  );
}
