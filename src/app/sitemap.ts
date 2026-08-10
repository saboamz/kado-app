import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * The four pages worth finding.
 *
 * Small on purpose, and it will stay small: everything else in this app is
 * somebody's private list. A sitemap is a statement about what is public, so
 * padding it with sign-in forms would be a claim that they matter.
 *
 * No lastModified: it would be the date of the deployment, not of the
 * content, and a date that moves every deploy teaches a crawler to ignore it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/conditions`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
