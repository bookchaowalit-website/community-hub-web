import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("home page", () => {
  it("renders the seed room, the backup controls and the no-sync notice", () => {
    const html = renderToString(<Home />);
    expect(html).toContain("Keep the rooms");
    expect(html).toContain("Discord");
    expect(html).toContain("Daily standups");
    expect(html).toContain("Export JSON");
    expect(html).toContain("Import JSON");
    expect(html).toContain("Browser-local state");
    expect(html).toContain("NO MEMBERSHIP CLAIMS / NO SYNC");
  });
});
