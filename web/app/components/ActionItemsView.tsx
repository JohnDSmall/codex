"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquarePlus,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  ACTION_CATEGORIES,
  ACTION_PRIORITIES,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  type ActionCategory,
  type ActionItem,
  type ActionNote,
} from "@/lib/action-items";
import { ACTIVITY_CATEGORY_CLASS, ACTIVITY_CATEGORY_LABEL } from "@/lib/planner";

type StatusFilter = "active" | "completed" | "all";

const selectCls =
  "rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-1.5 py-1 text-xs outline-none focus:border-indigo-500";

export function ActionItemsView({
  items,
  notes,
  today,
  createActionItem,
  addActionNote,
  deleteActionNote,
  setActionPriority,
  setActionCategory,
  setActionDueDate,
  setActionDescription,
  setActionStatus,
  deleteActionItem,
}: {
  items: ActionItem[];
  notes: ActionNote[];
  today: string;
  createActionItem: (fd: FormData) => Promise<void>;
  addActionNote: (itemId: string, fd: FormData) => Promise<void>;
  deleteActionNote: (id: string, itemId: string) => Promise<void>;
  setActionPriority: (id: string, priority: string) => Promise<void>;
  setActionCategory: (id: string, category: string) => Promise<void>;
  setActionDueDate: (id: string, due: string) => Promise<void>;
  setActionDescription: (id: string, description: string) => Promise<void>;
  setActionStatus: (id: string, status: string) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<StatusFilter>("active");
  const [category, setCategory] = useState<ActionCategory | "all">("all");
  const [pending, start] = useTransition();

  const notesByItem = useMemo(() => {
    const m = new Map<string, ActionNote[]>();
    for (const n of notes) {
      const list = m.get(n.item_id);
      if (list) list.push(n);
      else m.set(n.item_id, [n]);
    }
    return m;
  }, [notes]);

  const filtered = useMemo(() => {
    const list = items.filter(
      (i) =>
        (status === "all" || i.status === status) &&
        (category === "all" || i.category === category),
    );
    // Active: priority, then due (overdue first, no-due last), then newest.
    // Completed: most recently completed first.
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      if (a.status === "completed") return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
        b.seq - a.seq
      );
    });
  }, [items, status, category]);

  const counts = useMemo(() => {
    const c = { active: 0, completed: 0, all: items.length };
    for (const i of items) c[i.status]++;
    return c;
  }, [items]);

  return (
    <div className="space-y-4">
      {/* quick add */}
      <form
        action={(fd) => start(() => createActionItem(fd))}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 flex flex-wrap items-center gap-2"
      >
        <input
          name="description"
          required
          placeholder="New action item…"
          autoComplete="off"
          className="flex-1 min-w-[220px] rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <select name="priority" defaultValue="medium" className={selectCls} aria-label="Priority">
          {ACTION_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <select name="category" defaultValue="work" className={selectCls} aria-label="Category">
          {ACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ACTIVITY_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <input name="due_date" type="date" className={selectCls} aria-label="Due date (optional)" title="Due date (optional)" />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["active", "completed", "all"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm border ${
              status === s
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            {s === "active" ? "Open" : s === "completed" ? "Completed" : "All"}{" "}
            <span className={`tabular-nums ${status === s ? "text-indigo-200" : "text-neutral-400"}`}>
              {counts[s]}
            </span>
          </button>
        ))}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ActionCategory | "all")}
          className="ml-auto rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
        >
          <option value="all">All categories</option>
          {ACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ACTIVITY_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-10 text-center text-neutral-500">
          Nothing here. Add an action item above.
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-100 dark:divide-neutral-800">
          {filtered.map((item) => (
            <ActionRow
              key={item.id}
              item={item}
              notes={notesByItem.get(item.id) ?? []}
              today={today}
              addActionNote={addActionNote}
              deleteActionNote={deleteActionNote}
              setActionPriority={setActionPriority}
              setActionCategory={setActionCategory}
              setActionDueDate={setActionDueDate}
              setActionDescription={setActionDescription}
              setActionStatus={setActionStatus}
              deleteActionItem={deleteActionItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({
  item,
  notes,
  today,
  addActionNote,
  deleteActionNote,
  setActionPriority,
  setActionCategory,
  setActionDueDate,
  setActionDescription,
  setActionStatus,
  deleteActionItem,
}: {
  item: ActionItem;
  notes: ActionNote[];
  today: string;
  addActionNote: (itemId: string, fd: FormData) => Promise<void>;
  deleteActionNote: (id: string, itemId: string) => Promise<void>;
  setActionPriority: (id: string, priority: string) => Promise<void>;
  setActionCategory: (id: string, category: string) => Promise<void>;
  setActionDueDate: (id: string, due: string) => Promise<void>;
  setActionDescription: (id: string, description: string) => Promise<void>;
  setActionStatus: (id: string, status: string) => Promise<void>;
  deleteActionItem: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const done = item.status === "completed";
  const overdue = !done && item.due_date !== null && item.due_date < today;
  const catCls = ACTIVITY_CATEGORY_CLASS[item.category];

  return (
    <div className={done ? "opacity-60" : ""}>
      <div className="px-3 py-2.5 flex items-center gap-2.5 flex-wrap">
        {/* complete / reopen */}
        <button
          onClick={() => start(() => setActionStatus(item.id, done ? "active" : "completed"))}
          disabled={pending}
          title={done ? "Reopen" : "Mark completed"}
          className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
            done
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-neutral-300 dark:border-neutral-600 hover:border-emerald-500"
          }`}
        >
          {done && <Check className="w-3.5 h-3.5" />}
        </button>

        <span className="text-xs text-neutral-400 tabular-nums shrink-0">#{item.seq}</span>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 min-w-[180px] text-left flex items-center gap-1.5"
          title="Show notes"
        >
          {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-neutral-400" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-neutral-400" />}
          <span className={`text-sm ${done ? "line-through" : ""}`}>{item.description}</span>
          {notes.length > 0 && (
            <span className="text-xs text-neutral-400 tabular-nums">({notes.length})</span>
          )}
        </button>

        {/* inline flips */}
        <select
          value={item.priority}
          disabled={pending}
          onChange={(e) => start(() => setActionPriority(item.id, e.target.value))}
          className={`${selectCls} font-medium ${PRIORITY_CLASS[item.priority]} border-transparent`}
          aria-label="Priority"
        >
          {ACTION_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <select
          value={item.category}
          disabled={pending}
          onChange={(e) => start(() => setActionCategory(item.id, e.target.value))}
          className={`${selectCls} border ${catCls.bar}`}
          aria-label="Category"
        >
          {ACTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>{ACTIVITY_CATEGORY_LABEL[c]}</option>
          ))}
        </select>
        <input
          type="date"
          value={item.due_date ?? ""}
          disabled={pending}
          onChange={(e) => start(() => setActionDueDate(item.id, e.target.value))}
          className={`${selectCls} ${overdue ? "text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/40" : "text-neutral-500"}`}
          aria-label="Due date"
          title={overdue ? "Overdue" : "Due date"}
        />

        <span className="text-[11px] text-neutral-400 tabular-nums whitespace-nowrap hidden lg:inline" title="added · last update">
          {item.created_at.slice(0, 10)} · {item.updated_at.slice(0, 10)}
        </span>
      </div>

      {open && (
        <div className="pl-12 pr-4 pb-3 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="group flex items-start gap-2 text-sm">
              <span className="text-xs text-neutral-400 tabular-nums whitespace-nowrap mt-0.5">
                {n.created_at.slice(0, 10)}
              </span>
              <span className="flex-1 whitespace-pre-wrap">{n.content}</span>
              <button
                onClick={() => start(() => deleteActionNote(n.id, item.id))}
                disabled={pending}
                title="Delete note"
                className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <form
            action={(fd) => start(() => addActionNote(item.id, fd))}
            className="flex items-center gap-2"
          >
            <MessageSquarePlus className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              name="content"
              required
              placeholder="Add a note…"
              autoComplete="off"
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
            />
            <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50">
              Note
            </button>
          </form>
          <div className="flex items-center justify-between pt-1">
            <EditDescription item={item} onSave={(d) => start(() => setActionDescription(item.id, d))} pending={pending} />
            {confirmDelete ? (
              <span className="text-xs flex items-center gap-2">
                Delete #{item.seq} and its notes?
                <button onClick={() => start(() => deleteActionItem(item.id))} disabled={pending} className="text-rose-600 font-medium">Delete</button>
                <button onClick={() => setConfirmDelete(false)}>Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-neutral-400 hover:text-rose-600 inline-flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
            {done && (
              <button
                onClick={() => start(() => setActionStatus(item.id, "active"))}
                disabled={pending}
                className="text-xs text-neutral-500 hover:text-indigo-600 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reopen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditDescription({
  item,
  onSave,
  pending,
}: {
  item: ActionItem;
  onSave: (d: string) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.description);
  if (!editing) {
    return (
      <button onClick={() => { setText(item.description); setEditing(true); }} className="text-xs text-neutral-400 hover:text-indigo-600">
        Edit description
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2 flex-1 mr-3">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500"
      />
      <button
        onClick={() => { onSave(text); setEditing(false); }}
        disabled={pending || !text.trim()}
        className="text-xs font-medium text-indigo-600 disabled:opacity-50"
      >
        Save
      </button>
      <button onClick={() => setEditing(false)} className="text-xs text-neutral-400">Cancel</button>
    </span>
  );
}
