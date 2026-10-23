import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/mcp/route";
import { SEED } from "@/lib/channels";

const post = (body: unknown) =>
  POST(new Request("https://example.test/api/mcp", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));
const call = async (id: number, name: string, args: Record<string, unknown> = {}) => {
  const response = await post({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
  return response.json();
};
const textOf = (json: { result: { content: { text: string }[] } }) => JSON.parse(json.result.content[0].text);

describe("POST /api/mcp", () => {
  it("lists the two directory tools and echoes the request id", async () => {
    const json = await (await post({ jsonrpc: "2.0", id: "list-1", method: "tools/list" })).json();
    expect(json.id).toBe("list-1");
    expect(json.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["describe_directory", "validate_room"]);
  });

  it("describe_directory returns the real seed rooms and limits", async () => {
    const json = await call(2, "describe_directory");
    expect(json.id).toBe(2);
    expect(textOf(json)).toMatchObject({ seed: SEED, statuses: expect.any(Array) });
  });

  it("validate_room applies the add-form rules", async () => {
    expect(textOf(await call(3, "validate_room", { title: "Research circle", url: "https://example.com/room" }))).toMatchObject({ valid: true, room: { title: "Research circle", status: "Draft" } });
    expect(textOf(await call(4, "validate_room", { title: "Bad link", url: "javascript:alert(1)" }))).toMatchObject({ valid: false });
    expect(textOf(await call(5, "validate_room", { title: "Odd", status: "Secret" }))).toEqual({ valid: false, error: 'Unknown status "Secret".' });
  });

  it("answers unknown tools with a JSON-RPC error, bad JSON with 400 and notifications with 202", async () => {
    expect((await call(6, "delete_everything")).error).toBeDefined();
    const bad = await post("{not json");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe(-32700);
    const note = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(note.status).toBe(202);
  });
});
