import type { MetadataRoute } from "next";
import { many, parseJson, type Row } from "@/server/db";

// Regenerated hourly so newly published experiences enter the index.
export const revalidate = 3600;


const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/**
 * Only genuinely public, published experiences of non-demo organisations are
 * listed. Drafts, archived properties and demo fixtures stay out of the index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const rows = many<Row>(
    `SELECT e.slug, e.updated_at, o.settings
     FROM property_experiences e
     JOIN properties p ON p.id = e.property_id
     JOIN organizations o ON o.id = e.org_id
     WHERE e.status = 'published' AND p.status != 'archived'`,
  );

  const experiences: MetadataRoute.Sitemap = rows
    .filter((row) => !parseJson<{ demo?: boolean }>(row.settings, {}).demo)
    .map((row) => ({
      url: `${base}/p/${row.slug}`,
      lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/legal/privacidade`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/legal/termos`, changeFrequency: "yearly", priority: 0.2 },
    ...experiences,
  ];
}
