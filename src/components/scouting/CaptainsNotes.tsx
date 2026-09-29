"use client";

import { useActionState, useState } from "react";
import { addNote, deleteNote } from "@/lib/actions/notes";

export interface Note {
  id: string;
  body: string;
  createdAt: string;
}

/** Admin-only. Collapsed to a one-line bar by default (Ali rarely expects to use it). */
export function CaptainsNotes({ notes, teamId, opponentId, path }: { notes: Note[]; teamId: string; opponentId: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(addNote, {});
  return (
    <section aria-labelledby="notes" className="border border-line bg-panel">
      <div className="flex items-center justify-between gap-4 px-4 py-[14px] lg:px-6">
        <div className="flex flex-col gap-[2px]">
          <h2 id="notes" className="m-0 font-display text-lg font-bold uppercase tracking-[0.06em]">Captain&apos;s notes</h2>
          <span className="text-[13px] text-muted">
            {notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "None yet"} · only visible when signed in
          </span>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="notes-body"
          onClick={() => setOpen((o) => !o)}
          className="h-11 shrink-0 cursor-pointer border border-line-strong bg-transparent px-[18px] text-sm font-medium text-text hover:border-muted"
        >
          {open ? "Close ▴" : notes.length ? "Notes ▾" : "Add note ▾"}
        </button>
      </div>
      {open && (
        <div id="notes-body" className="flex flex-col gap-3 border-t border-line px-4 py-4 lg:px-6">
          {notes.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-4 border border-line bg-inset px-4 py-3">
              <div className="flex flex-col gap-1">
                <p className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-pattern">{n.body}</p>
                <span className="text-xs text-muted">{new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="path" value={path} />
                <button type="submit" className="h-11 cursor-pointer bg-transparent px-3 text-sm text-text-3 hover:text-loss" aria-label="Delete note">
                  Delete
                </button>
              </form>
            </div>
          ))}
          <form action={action} className="flex flex-col gap-2">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="opponentId" value={opponentId} />
            <input type="hidden" name="path" value={path} />
            <label htmlFor="note-body" className="label">New note</label>
            <textarea
              id="note-body"
              name="body"
              rows={3}
              required
              className="border border-line-strong bg-inset p-3 text-[15px] text-text"
              placeholder="e.g. Their striker overcommits on kickoffs"
            />
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pending} className="clip-para h-11 cursor-pointer bg-accent px-5 font-display text-sm font-bold tracking-[0.1em] text-on-accent disabled:opacity-60">
                {pending ? "SAVING…" : "SAVE NOTE"}
              </button>
              {state.error && <span className="text-sm text-loss" role="alert">{state.error}</span>}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
