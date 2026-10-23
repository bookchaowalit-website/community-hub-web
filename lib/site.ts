/** Default canonical origin (the live custom domain); override per deployment with NEXT_PUBLIC_SITE_URL. */
export const DEFAULT_SITE_URL = "https://community.bookchaowalit.com";

/** Canonical origin for metadata, robots.txt and sitemap.xml. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
