"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppFoot, AppTop, ListButton, PlusIcon, type Tone } from "@/components/app-shell";
import { MAX_BODY, MAX_TITLE, SEED, STATUSES, STORAGE_KEY, channelsIn, createChannel, exportChannels, formatAdded, importChannels, parseStoredChannels, restoreChannel, setStatus, type Channel, type Filter, type NewChannelInput as Draft, type Status as ChannelStatus } from "@/lib/channels";
import { useStoredState } from "@/lib/use-stored-state";

const EMPTY_DRAFT: Draft = { title: "", body: "", url: "", status: "Draft" };

type Removed = { channel: Channel; beforeId: string | null; nextShown?: string; prevShown?: string; viaKeyboard: boolean };

const TONE: Record<ChannelStatus, Tone> = { Draft: "amber", Active: "green", Done: "grey" };
const FILTERS: Filter[] = ["All", ...STATUSES];

export default function Home() {
  const [channels, setChannels] = useStoredState(STORAGE_KEY, SEED, parseStoredChannels);
  const [formError, setFormError] = useState("");
  const [backupNotice, setBackupNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [toastFocused, setToastFocused] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const toastRef = useRef<HTMLDivElement>(null);
  const wasComposing = useRef(false);
  const focusNext = useRef<string[] | null>(null);
  const visible = useMemo(() => channelsIn(channels, filter, query), [channels, filter, query]);
  const countOf = (value: Filter) => (value === "All" ? channels.length : channels.filter((item) => item.status === value).length);

  // Opening the composer focuses the title; closing it returns focus to Add a room.
  useEffect(() => {
    if (composing) titleRef.current?.focus();
    else if (wasComposing.current) newRef.current?.focus();
    wasComposing.current = composing;
  }, [composing]);
  useEffect(() => { if (removed?.viaKeyboard) undoRef.current?.focus(); }, [removed]);
  // After the toast closes, focus goes to the nearest row still shown, else Add a room.
  useEffect(() => {
    const ids = focusNext.current;
    if (removed || !ids) return;
    focusNext.current = null;
    const rows = [...document.querySelectorAll<HTMLElement>(".as-row[data-channel]")];
    const row = ids.map((id) => rows.find((r) => r.dataset.channel === id)).find(Boolean);
    (row?.querySelector<HTMLButtonElement>(".as-danger") ?? newRef.current ?? titleRef.current)?.focus();
  }, [removed, channels]);
  // Reserve the toast's height at the bottom so a control focused behind it scrolls clear.
  const toastShown = removed !== null;
  useLayoutEffect(() => {
    const toast = toastRef.current;
    if (!toastShown || !toast) return;
    const rootStyle = document.documentElement.style;
    const reserve = () => rootStyle.setProperty("--as-toast-space", `${toast.offsetHeight + 32}px`);
    reserve();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(reserve) : null;
    observer?.observe(toast);
    return () => { observer?.disconnect(); rootStyle.removeProperty("--as-toast-space"); };
  }, [toastShown]);
  // The toast closes 6 s after a removal, but never while it holds focus.
  useEffect(() => {
    if (!removed || toastFocused) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [removed, toastFocused]);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = createChannel(draft, Date.now());
    if ("error" in result) {
      setFormError(result.error);
      return;
    }
    const channel = result.channel;
    setChannels((items) => [channel, ...items]);
    if (filter !== "All" && filter !== channel.status) setFilter(channel.status);
    setQuery("");
    setAnnouncement(`Added “${channel.title}” to the directory.`);
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setComposing(false);
  }
  function changeStatus(channel: Channel, status: ChannelStatus) {
    setChannels((items) => setStatus(items, channel.id, status));
    setAnnouncement(`“${channel.title}” is now ${status}.`);
  }
  function exportJson() {
    const href = URL.createObjectURL(new Blob([exportChannels(channels)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "community-directory.json";
    anchor.click();
    URL.revokeObjectURL(href);
    setBackupNotice(`Exported ${channels.length} ${channels.length === 1 ? "room" : "rooms"}.`);
  }
  async function importJson(file: File | undefined) {
    if (!file) return;
    const result = importChannels(channels, await file.text());
    if ("error" in result) {
      setBackupNotice(result.error);
      return;
    }
    setChannels(result.channels);
    setBackupNotice(`Imported ${result.added} new ${result.added === 1 ? "room" : "rooms"}${result.skipped ? `, skipped ${result.skipped} (already here or invalid)` : ""}.`);
  }
  function clearSearch() {
    setQuery("");
    searchRef.current?.focus();
  }
  function remove(channel: Channel, viaKeyboard: boolean) {
    const index = channels.findIndex((item) => item.id === channel.id);
    if (index < 0) return;
    const shownAt = visible.findIndex((item) => item.id === channel.id);
    setChannels((items) => items.filter((item) => item.id !== channel.id));
    setRemoved({ channel, beforeId: channels[index + 1]?.id ?? null, nextShown: visible[shownAt + 1]?.id, prevShown: shownAt > 0 ? visible[shownAt - 1].id : undefined, viaKeyboard });
    setAnnouncement(`Removed “${channel.title}”. Undo is available for a few seconds.`);
  }
  function closeToast(ids?: string[]) {
    focusNext.current = ids ?? [removed?.nextShown, removed?.prevShown].filter((id): id is string => Boolean(id));
    setRemoved(null);
    setToastFocused(false);
  }
  function undo() {
    if (!removed) return;
    const { channel, beforeId } = removed;
    setChannels((items) => restoreChannel(items, channel, beforeId));
    setAnnouncement(`Restored “${channel.title}”.`);
    closeToast([channel.id]);
  }

  const title = filter === "All" ? "All rooms" : filter;

  return (
    <div className="as">
      <a className="as-skip" href="#main">Skip to content</a>
      <AppTop name="Community Hub" tagline="Rooms and resources, easy to find" />

      <div className="as-body">
        <aside className="as-side" aria-label="Lists">
          <h2>Directory</h2>
          <ul className="as-lists">
            {FILTERS.map((value) => (
              <ListButton key={value} label={value === "All" ? "All rooms" : value} count={countOf(value)} tone={value === "All" ? undefined : TONE[value]} current={filter === value} onSelect={() => setFilter(value)} />
            ))}
          </ul>
        </aside>

        <main id="main" className="as-main">
          <div className="as-head">
            <div>
              <h1>{title}</h1>
              <p aria-live="polite">{visible.length} {visible.length === 1 ? "room" : "rooms"}{query.trim() ? ` matching “${query.trim()}”` : ""}</p>
            </div>
            <div className="as-tools">
              <label className="as-search">
                <span className="as-sr">Search rooms</span>
                <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
              </label>
              {composing ? null : <button ref={newRef} type="button" className="as-button" onClick={() => setComposing(true)}><PlusIcon />Add a room</button>}
            </div>
          </div>

          {composing ? (
            <form className="as-composer" onSubmit={add} aria-label="New room" noValidate>
              <label className="as-field">Name
                <input ref={titleRef} value={draft.title} onChange={(event) => { setDraft({ ...draft, title: event.target.value }); setFormError(""); }} placeholder="e.g. Research circle" maxLength={MAX_TITLE} autoComplete="off" required />
              </label>
              <label className="as-field">What happens here
                <textarea value={draft.body} onChange={(event) => { setDraft({ ...draft, body: event.target.value }); setFormError(""); }} placeholder="A short description" maxLength={MAX_BODY} rows={2} />
              </label>
              <label className="as-field">Link (optional)
                <input type="url" inputMode="url" value={draft.url} onChange={(event) => { setDraft({ ...draft, url: event.target.value }); setFormError(""); }} placeholder="https://" autoComplete="off" aria-invalid={formError ? true : undefined} aria-describedby={formError ? "room-error" : undefined} />
              </label>
              {formError ? <p id="room-error" className="hub-error" role="alert">{formError}</p> : null}
              <div className="as-composer-foot">
                <div className="as-segmented-wrap">
                  <span id="state-label">Start as</span>
                  <div className="as-segmented" role="group" aria-labelledby="state-label">
                    {STATUSES.map((status) => (
                      <button key={status} type="button" aria-pressed={draft.status === status} onClick={() => setDraft({ ...draft, status })}>{status}</button>
                    ))}
                  </div>
                </div>
                <div className="as-composer-actions">
                  <button type="button" className="as-plain" onClick={() => { setComposing(false); setDraft(EMPTY_DRAFT); setFormError(""); }}>Cancel</button>
                  <button type="submit" className="as-button" disabled={!draft.title.trim()}>Add</button>
                </div>
              </div>
            </form>
          ) : null}

          {visible.length ? (
            <ul className="as-list" aria-label={title}>
              {visible.map((channel) => (
                <li className="as-row" key={channel.id} data-channel={channel.id}>
                  <div>
                    <h3>{channel.title}</h3>
                    <p className="as-row-detail">{channel.body}</p>
                    <p className="as-row-meta">
                      {channel.createdAt ? <>Added <time dateTime={new Date(channel.createdAt).toISOString()}>{formatAdded(channel.createdAt)}</time></> : "Added date unknown"}
                      {channel.url ? null : " · No link saved"}
                    </p>
                    {channel.url ? <a className="hub-link" href={channel.url} target="_blank" rel="noopener noreferrer">Open room<span className="as-sr"> {channel.title} (opens in a new tab)</span></a> : null}
                  </div>
                  <label className="hub-state">
                    <span className="as-sr">State of {channel.title}</span>
                    <select value={channel.status} data-tone={TONE[channel.status]} onChange={(event) => changeStatus(channel, event.target.value as ChannelStatus)}>
                      {STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <button type="button" className="as-plain as-danger" aria-label={`Remove ${channel.title}`} onClick={(event) => remove(channel, event.detail === 0)}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="as-list as-empty">
              {query.trim() ? (
                <>
                  <strong>Nothing matches</strong>
                  No room in {filter === "All" ? "the directory" : title} mentions “{query.trim()}”.
                  <div className="as-actions-row hub-center"><button type="button" className="as-plain" onClick={clearSearch}>Clear search</button></div>
                </>
              ) : channels.length === 0 ? (
                <><strong>The directory is empty</strong>Rooms you add are kept in this browser only. Press Add a room to list the first channel or resource, or import a JSON backup below.</>
              ) : (
                <><strong>Nothing is {title} yet</strong>Change a room&apos;s state, or press Add a room and start it as {title}.</>
              )}
            </div>
          )}

          <section className="as-section" aria-labelledby="backup-title">
            <div className="as-section-head hub-backup-head">
              <h2 id="backup-title" className="as-section-title">Backup</h2>
              <div className="hub-backup">
                <button type="button" className="as-plain" onClick={exportJson}>Export JSON</button>
                <label className="as-plain hub-import">Import JSON<input type="file" accept="application/json,.json" onChange={(event) => { void importJson(event.target.files?.[0]); event.target.value = ""; }} /></label>
              </div>
            </div>
            <p className="hub-status" role="status">{backupNotice}</p>
          </section>

          <p className="as-note">Saved in this browser only: no account, no membership claims, no sync. Export a JSON backup to move the directory to another browser.</p>
        </main>
      </div>

      <p className="as-sr" role="status" aria-live="polite">{announcement}</p>
      {removed ? (
        <div
          ref={toastRef}
          className="as-toast"
          role="group"
          aria-label="Undo remove"
          onFocus={() => setToastFocused(true)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setToastFocused(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") closeToast(); }}
        >
          <span>Removed “{removed.channel.title}”</span>
          <button ref={undoRef} type="button" className="as-plain" onClick={undo} aria-label="Undo remove">Undo</button>
        </div>
      ) : null}

      <AppFoot source="https://github.com/bookchaowalit-website/community-hub-web" />
    </div>
  );
}
