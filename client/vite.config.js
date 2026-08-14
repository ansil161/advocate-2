import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { practiceAreas } from './src/data/practiceAreas.js';

// The sitemap is generated from the same data the pages render, so a practice
// area added to data/practiceAreas.js appears in it without anyone remembering
// to. Hand-maintained sitemaps go stale on the first content change.
//
// The industry routes are deliberately absent: those pages are stubs and carry
// a noindex tag, so listing them would be asking for them to be indexed.
//
// `loc` must be an absolute URL per the sitemap protocol, so this only emits
// when VITE_SITE_URL is set. Guessing a domain would publish a sitemap of URLs
// that resolve nowhere, which is worse than shipping none.
function sitemap(origin) {
  const routes = [
    ['/', '1.0', 'monthly'],
    ['/about', '0.9', 'yearly'],
    ['/practice', '0.9', 'monthly'],
    ['/team', '0.8', 'monthly'],
    ['/awards', '0.7', 'yearly'],
    ['/landmark-cases', '0.7', 'yearly'],
    ['/contact', '0.8', 'yearly'],
    ...practiceAreas.map((p) => [`/practice/${p.slug}`, '0.7', 'yearly']),
  ];

  return {
    name: 'sla-sitemap',
    apply: 'build',
    generateBundle() {
      if (!origin) {
        this.warn(
          'VITE_SITE_URL is not set — sitemap.xml was not generated. Set it to the ' +
            'deployed origin (e.g. https://www.example.com) to emit one.'
        );
        return;
      }
      const base = origin.replace(/\/$/, '');
      const body = routes
        .map(
          ([path, priority, freq]) =>
            `  <url>\n    <loc>${base}${path}</loc>\n` +
            `    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
        )
        .join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `${body}\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), sitemap(env.VITE_SITE_URL)],
  };
});
