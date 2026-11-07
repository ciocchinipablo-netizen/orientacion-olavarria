// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const site = 'https://orientacionolavarria.com.ar';

// Post URL -> publish date (YYYY-MM-DD), read from the frontmatter of the CMS
// files, which are named after their slug. Only posts get a sitemap lastmod;
// static pages get none rather than a meaningless build date.
const blogDir = new URL('./src/content/blog/', import.meta.url);
/** @type {Map<string, string>} */
const postLastmod = new Map();
for (const file of (existsSync(blogDir) ? readdirSync(blogDir) : []).filter((f) => f.endsWith('.md'))) {
  const date = readFileSync(new URL(file, blogDir), 'utf8').match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m)?.[1];
  if (date) postLastmod.set(`${site}/blog/${file.slice(0, -3)}/`, date);
}

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  // Downloaded at build time and served from /_astro/fonts/ (no runtime request to Google).
  fonts: [{
    provider: fontProviders.google(),
    name: 'Playfair Display',
    cssVariable: '--font-playfair',
    weights: [400, 500],
    styles: ['normal', 'italic'],
    subsets: ['latin'],
    fallbacks: ['Georgia', 'Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Times New Roman', 'serif'],
  }],
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = postLastmod.get(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
  ],
});
