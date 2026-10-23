import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { DEFAULT_SITE_URL, SITE_URL } from "@/lib/site";

describe("site origin", () => {
  it("defaults to the live custom domain, not the old vercel.app host", () => {
    expect(DEFAULT_SITE_URL).toBe("https://community.bookchaowalit.com");
    expect(SITE_URL).toBe(DEFAULT_SITE_URL);
  });

  it("robots.txt hides the API and points at the sitemap on the same origin", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` });
  });

  it("sitemap.xml lists the home page and the project page", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([SITE_URL, `${SITE_URL}/more-projects`]);
  });
});
