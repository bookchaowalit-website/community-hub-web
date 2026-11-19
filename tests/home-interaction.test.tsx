// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { STORAGE_KEY, SEED } from "@/lib/channels";
import { resetStoredCache } from "@/lib/use-stored-state";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;
const $ = <T extends Element = HTMLElement>(selector: string) => host.querySelector(selector) as T | null;
const $$ = (selector: string) => [...host.querySelectorAll<HTMLInputElement>(selector)];
const button = (text: string, scope: ParentNode = host) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)) as HTMLButtonElement;
const rows = () => [...host.querySelectorAll(".as-row h3")].map((h) => h.textContent);
const press = (el: Element, detail = 0) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
const submit = () => act(() => { $<HTMLFormElement>(".as-composer")!.requestSubmit(); });
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);

beforeEach(() => {
  localStorage.clear();
  resetStoredCache();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<Home />));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("adding a room", () => {
  it("opens focused, keeps Add disabled without a name, saves a linked room on top and returns focus", () => {
    press(button("Add a room"));
    expect(document.activeElement).toBe($(".as-composer input"));
    expect(button("Add", $(".as-composer-actions")!).disabled).toBe(true);
    type($$(".as-composer input")[0], "Research circle");
    type($<HTMLTextAreaElement>(".as-composer textarea")!, "Weekly reading");
    type($$(".as-composer input")[1], "https://example.com/room");
    press(button("Active", $(".as-composer")!));
    submit();
    expect(rows()).toEqual(["Research circle", "Discord"]);
    expect(document.activeElement?.textContent).toContain("Add a room");
    expect(stored()[0]).toMatchObject({ title: "Research circle", status: "Active", url: "https://example.com/room" });
    expect($<HTMLAnchorElement>(".hub-link")!.href).toBe("https://example.com/room");
  });

  it("shows the error for a bad link instead of failing silently, and Cancel clears it", () => {
    press(button("Add a room"));
    type($$(".as-composer input")[0], "Bad link");
    type($$(".as-composer input")[1], "javascript:alert(1)");
    submit();
    expect($('[role="alert"]')!.textContent).toContain("https://");
    expect(rows()).toEqual(["Discord"]);
    press(button("Cancel"));
    expect($('[role="alert"]')).toBeNull();
    expect($(".as-composer")).toBeNull();
  });

  it("adding from another list switches to the new room's list", () => {
    press(button("Done", $(".as-side")!));
    expect(host.textContent).toContain("Nothing is Done yet");
    press(button("Add a room"));
    type($$(".as-composer input")[0], "Forum");
    submit();
    expect($("h1")!.textContent).toBe("Draft");
    expect(host.textContent).toContain("No description yet.");
  });
});

describe("state, search, remove and undo", () => {
  it("changes a room's state from its row", () => {
    const select = $<HTMLSelectElement>(".hub-state select")!;
    act(() => {
      select.value = "Done";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(stored()[0].status).toBe("Done");
  });

  it("search shows a way back when nothing matches", () => {
    type($<HTMLInputElement>(".as-search input")!, "zzz");
    expect(host.textContent).toContain("Nothing matches");
    press(button("Clear search"));
    expect(document.activeElement).toBe($(".as-search input"));
  });

  it("Remove is undoable; the empty directory explains storage and how to start", () => {
    press($('[aria-label="Remove Discord"]')!);
    expect(host.textContent).toContain("The directory is empty");
    expect(host.textContent).toContain("kept in this browser only");
    expect(document.activeElement).toBe(button("Undo"));
    press(button("Undo"));
    expect(rows()).toEqual(["Discord"]);
    vi.useFakeTimers();
    press($('[aria-label="Remove Discord"]')!, 1);
    act(() => { vi.advanceTimersByTime(6100); });
    expect($(".as-toast")).toBeNull();
    expect(document.activeElement?.textContent).toContain("Add a room");
  });

  it("Escape closes the toast", () => {
    press($('[aria-label="Remove Discord"]')!);
    act(() => { $(".as-toast")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect($(".as-toast")).toBeNull();
  });
});

describe("backup", () => {
  it("exports the directory as a JSON download", () => {
    const create = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    press(button("Export JSON"));
    expect(create).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(host.textContent).toContain("Exported 1 room.");
  });

  it("imports new rooms from a backup file and reports bad files", async () => {
    const input = $<HTMLInputElement>('.hub-import input[type="file"]')!;
    const pick = async (text: string) => {
      const file = { text: async () => text } as unknown as File;
      Object.defineProperty(input, "files", { value: [file], configurable: true });
      await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    };
    await pick(JSON.stringify({ channels: [{ id: "x1", title: "Imported", body: "b", status: "Active", createdAt: 1 }] }));
    expect(rows()).toContain("Imported");
    expect(host.textContent).toContain("Imported 1 new room");
    await pick("not json");
    expect(host.textContent).toContain("not valid JSON");
  });
});

describe("batch Undo", () => {
  afterEach(() => { vi.useRealTimers(); });
  // Three copies of the samples, so there are enough rows to remove two.
  beforeEach(() => {
    act(() => root.unmount());
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3].flatMap((n) => SEED.map((item) => ({ ...item, id: `${item.id}-${n}` })))));
    resetStoredCache();
    root = createRoot(host);
    act(() => root.render(<Home />));
  });
  // detail 0 = keyboard (Enter/Space) click, 1 = pointer click.
  const click = (el: Element, detail: number) => act(() => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail })); });
  const shownRows = () => [...host.querySelectorAll<HTMLElement>(".as-row[data-channel]")];
  const rowIds = () => shownRows().map((row) => row.getAttribute("data-channel"));
  const removeButton = (i: number) => shownRows()[i].querySelector<HTMLButtonElement>(".as-danger")!;
  const undoButton = () => host.querySelector<HTMLButtonElement>(".as-toast button")!;

  it("consecutive removes restore together with one Undo", () => {
    vi.useFakeTimers();
    const before = rowIds();
    expect(before.length).toBeGreaterThanOrEqual(3);
    click(removeButton(1), 1);
    act(() => { vi.advanceTimersByTime(4000); });
    click(removeButton(0), 1);
    expect(rowIds()).toEqual(before.slice(2));
    expect(host.querySelector(".as-toast span")!.textContent).toBe("Removed 2 rooms");
    expect(undoButton().getAttribute("aria-label")).toBe("Undo remove of 2 rooms");
    // The second removal restarted the 6 s window: 4 s later it is still open.
    act(() => { vi.advanceTimersByTime(4000); });
    click(undoButton(), 1);
    expect(rowIds()).toEqual(before);
    expect(host.querySelector(".as-toast")).toBeNull();
    expect(host.querySelector(".as-sr[role=status]")!.textContent).toBe("Restored 2 rooms.");
  });

  it("keyboard remove focuses Undo", () => {
    const before = rowIds();
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    click(removeButton(0), 0);
    expect(document.activeElement).toBe(undoButton());
    click(undoButton(), 0);
    expect(rowIds()).toEqual(before);
    // Back on the restored row removed last (it was second in the list).
    expect(document.activeElement).toBe(removeButton(1));
  });
});
