import { loadActionItems } from "@/lib/action-items-server";
import {
  addActionNote,
  createActionItem,
  deleteActionItem,
  deleteActionNote,
  setActionCategory,
  setActionDescription,
  setActionDueDate,
  setActionPriority,
  setActionStatus,
} from "@/lib/action-items-actions";
import { ActionItemsView } from "../components/ActionItemsView";

export const dynamic = "force-dynamic";

export default async function ActionsPage() {
  const { items, notes, tableMissing } = await loadActionItems();
  const today = new Date().toISOString().slice(0, 10);
  const active = items.filter((i) => i.status === "active");
  const overdue = active.filter((i) => i.due_date && i.due_date < today);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Actions</h1>
        <p className="text-sm text-neutral-500">
          {tableMissing ? (
            "Migration pending"
          ) : (
            <>
              {active.length} open{overdue.length > 0 ? ` · ${overdue.length} overdue` : ""} ·{" "}
              {items.length - active.length} completed · {notes.length} notes
            </>
          )}
        </p>
      </header>

      {tableMissing ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <strong className="font-medium">Migration pending.</strong> Apply{" "}
          <code className="text-xs">supabase/migrations/20260830150000_action_items.sql</code> in the
          Supabase SQL editor to create <code className="text-xs">action_items</code> and{" "}
          <code className="text-xs">action_item_notes</code>.
        </div>
      ) : (
        <ActionItemsView
          items={items}
          notes={notes}
          today={today}
          createActionItem={createActionItem}
          addActionNote={addActionNote}
          deleteActionNote={deleteActionNote}
          setActionPriority={setActionPriority}
          setActionCategory={setActionCategory}
          setActionDueDate={setActionDueDate}
          setActionDescription={setActionDescription}
          setActionStatus={setActionStatus}
          deleteActionItem={deleteActionItem}
        />
      )}
    </div>
  );
}
