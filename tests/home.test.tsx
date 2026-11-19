import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import RootLayout, { metadata } from "@/app/layout";

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "font-geist" }) }));

describe("home page", () => {
  it("renders the seed room, the state lists, the backup controls and the no-sync note on the App shell", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("<h1>All rooms</h1>");
    expect(html).toContain("Discord");
    expect(html).toContain("Daily standups");
    expect(html).toMatch(/All rooms<\/span><span class="as-count">1</);
    expect(html).toContain("Export JSON");
    expect(html).toContain("Import JSON");
    expect(html).toContain("No link saved");
    expect(html).toContain("no membership claims, no sync");
    expect(html).toContain('href="https://bookchaowalit.com/"');
  });

  it("puts the font variable on <html> and the site's own domain in metadata", () => {
    const html = renderToString(<RootLayout><p>child</p></RootLayout>);
    expect(html).toContain('<html lang="en" class="font-geist"');
    expect(String(metadata.metadataBase)).toBe("https://community.bookchaowalit.com/");
  });
});
