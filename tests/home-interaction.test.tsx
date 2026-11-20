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

  it("an import that finishes after Undo keeps the restored rooms", async () => {
    const before = rowIds();
    click(removeButton(0), 1);
    // The file is still being read when the user presses Undo.
    let finish!: (text: string) => void;
    const file = { text: () => new Promise<string>((resolve) => { finish = resolve; }) } as unknown as File;
    const input = host.querySelector<HTMLInputElement>('.hub-import input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    click(undoButton(), 1);
    expect(rowIds()).toEqual(before);
    await act(async () => { finish(JSON.stringify({ channels: [{ id: "x1", title: "Imported", body: "b", status: "Active", createdAt: 1 }] })); });
    expect(rowIds()).toEqual([...before, "x1"]);
    expect(stored().map((item: { id: string }) => item.id)).toEqual([...before, "x1"]);
  });

  it("an import that adds nothing does not write", async () => {
    const setItem = vi.spyOn(localStorage, "setItem");
    const file = { text: async () => JSON.stringify({ channels: [{ ...SEED[0], id: "channel-01-1" }] }) } as unknown as File;
    const input = host.querySelector<HTMLInputElement>('.hub-import input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("Imported 0 new rooms");
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("long descriptions", () => {
  it("a clipped description gets Show more / Show less", () => {
    act(() => root.unmount());
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...SEED[0], body: "A long description ".repeat(20).trim() }]));
    resetStoredCache();
    root = createRoot(host);
    act(() => root.render(<Home />));
    const more = button("Show more");
    expect(more.getAttribute("aria-expanded")).toBe("false");
    const detail = host.querySelector<HTMLElement>(`#${CSS.escape(more.getAttribute("aria-controls")!)}`)!;
    expect(detail.className).toContain("as-row-detail");
    press(more);
    expect(detail.dataset.expanded).toBe("true");
    expect(button("Show less").getAttribute("aria-expanded")).toBe("true");
  });

  it("a short description has no Show more", () => {
    expect(button("Show more")).toBeUndefined();
  });
});

describe("state change focus", () => {
  beforeEach(() => {
    act(() => root.unmount());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"].map((id, i) => ({ id, title: `Room ${id}`, body: "x", status: "Active", createdAt: 1710000000000 + i }))));
    resetStoredCache();
    root = createRoot(host);
    act(() => root.render(<Home />));
    press(button("Active"));
  });
  const selectOf = (id: string) => host.querySelector<HTMLSelectElement>(`.as-row[data-channel="${id}"] select`);
  const change = (id: string, value: string) => {
    const select = selectOf(id)!;
    act(() => { select.focus(); select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); });
  };

  it("a row that leaves the filter hands focus to the next row's state, else the previous one, else the list", () => {
    change("a", "Done");
    expect(selectOf("a")).toBeNull();
    expect(document.activeElement).toBe(selectOf("b"));
    change("c", "Done");
    expect(document.activeElement).toBe(selectOf("b"));
    change("b", "Draft");
    expect(document.activeElement).toBe(host.querySelector('.as-lists button[aria-current="true"]'));
  });

  it("a row that stays shown keeps focus", () => {
    press(button("All rooms"));
    change("a", "Done");
    expect(document.activeElement).toBe(selectOf("a"));
  });
});

describe("round 2", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "fonts");
  });
  const seed = (channels: object[]) => {
    act(() => root.unmount());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
    resetStoredCache();
    root = createRoot(host);
    act(() => root.render(<Home />));
  };

  it("Undo after importing a backup with the same id restores the version that was removed", async () => {
    seed([{ id: "r1", title: "Room one", body: "x", status: "Done", createdAt: 1710000000000 }]);
    press(host.querySelector<HTMLButtonElement>(".as-row .as-danger")!, 1);
    const input = $<HTMLInputElement>('.hub-import input[type="file"]')!;
    const file = { text: async () => JSON.stringify({ channels: [{ id: "r1", title: "Room one (old)", body: "x", status: "Active", createdAt: 1710000000000 }] }) } as unknown as File;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(rows()).toEqual(["Room one (old)"]);
    press(button("Undo"), 1);
    expect(rows()).toEqual(["Room one"]);
    expect(stored()[0]).toMatchObject({ title: "Room one", status: "Done" });
  });

  it("a state change that drops the room out of the search hands focus on", () => {
    seed(["a", "b"].map((id, i) => ({ id, title: `Room ${id}`, body: "x", status: "Active", createdAt: 1710000000000 + i })));
    type($<HTMLInputElement>(".as-search input")!, "active");
    const select = host.querySelector<HTMLSelectElement>('.as-row[data-channel="a"] select')!;
    act(() => { select.focus(); select.value = "Done"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector('.as-row[data-channel="a"]')).toBeNull();
    expect(document.activeElement).toBe(host.querySelector('.as-row[data-channel="b"] select'));
  });

  it("measures descriptions again when fonts are ready", async () => {
    let fontsReady!: () => void;
    const ready = new Promise<void>((resolve) => { fontsReady = resolve; });
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready, addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    let wide = 200;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("as-row-detail") ? wide : 200;
    });
    seed([{ id: "a", title: "Room a", body: "Fits with the fallback font", status: "Active", createdAt: 1710000000000 }]);
    expect(button("Show more")).toBeUndefined();
    wide = 260;
    await act(async () => { fontsReady(); await ready; });
    expect(button("Show more")).toBeDefined();
  });
});

