import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts (drafts excluded), newest first. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

// The CMS stores `date` as a timezone-less wall-clock string (Argentina time),
// which parses as UTC. Formatting in UTC shows exactly the day the author picked.
const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** e.g. "5 de marzo de 2026" */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** YYYY-MM-DD, for <time datetime> and JSON-LD (avoids a wrong UTC offset). */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
