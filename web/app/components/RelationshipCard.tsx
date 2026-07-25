import { Bell, Building2, Calendar } from "lucide-react";
import type { Contact } from "@/lib/types";
import {
  cardCompanies,
  daysToContact,
  displayName,
  formatDateLong,
  strengthBadgeClass,
  strengthLabel,
} from "@/lib/relationship";
import { logoForCompany } from "@/lib/company-logos";

export function RelationshipCard({ contact }: { contact: Contact }) {
  const name = displayName(contact);
  const days = daysToContact(contact);
  const lastContact = formatDateLong(contact.last_contact_date);
  const nextContact = formatDateLong(contact.target_contact_date);
  const allCompanies = cardCompanies(contact);
  const companies = allCompanies.slice(0, 6);
  const extraCompanies = allCompanies.length - companies.length;
  const reminders = contact.reminders ?? [];
  const tier = contact.strength_tier;

  return (
    <div className="h-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="font-semibold text-base leading-tight truncate">{name}</h3>
          {nextContact && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
              <Calendar className="w-3.5 h-3.5" />
              <span>Next: {nextContact}</span>
            </div>
          )}
          {lastContact && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>Last: {lastContact}</span>
            </div>
          )}
          {tier !== "none" && (
            <span
              className={`inline-block mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${strengthBadgeClass(tier)}`}
            >
              {strengthLabel(tier)}
            </span>
          )}
        </div>
        <DaysBox days={days} />
      </div>

      {companies.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {companies.map((c) => (
            <CompanyLogo key={c} name={c} />
          ))}
          {extraCompanies > 0 && (
            <span className="inline-flex h-12 items-center rounded-lg bg-neutral-100 dark:bg-neutral-800 px-2.5 text-sm font-medium text-neutral-500">
              +{extraCompanies}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">
          <Bell className="w-3.5 h-3.5" />
          <span>Reminders</span>
        </div>
        {reminders.length > 0 ? (
          <ul className="space-y-1">
            {reminders.slice(0, 3).map((r, i) => (
              <li key={i} className="text-xs text-neutral-700 dark:text-neutral-300 flex gap-2">
                <span className="text-neutral-400 leading-5">·</span>
                <span className="line-clamp-2">{r}</span>
              </li>
            ))}
            {reminders.length > 3 && (
              <li className="text-xs text-neutral-400">+{reminders.length - 3} more</li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-neutral-400">No reminders</p>
        )}
      </div>
    </div>
  );
}

function DaysBox({ days }: { days: number | null }) {
  if (days === null) {
    return (
      <div className="shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2 text-center min-w-[64px]">
        <div className="text-lg font-semibold text-neutral-400">—</div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-400">no f/u</div>
      </div>
    );
  }
  const overdue = days < 0;
  const colorClass = overdue
    ? "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : days <= 7
    ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`shrink-0 rounded-lg px-3 py-2 text-center min-w-[64px] ${colorClass}`}>
      <div className="text-lg font-semibold tabular-nums">{Math.abs(days)}</div>
      <div className="text-[10px] uppercase tracking-wider">{overdue ? "overdue" : "days"}</div>
    </div>
  );
}

function CompanyLogo({ name }: { name: string }) {
  const logo = logoForCompany(name);
  return (
    <span
      title={name}
      className="group relative inline-flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-visible"
    >
      {logo ? (
        // Logo is small enough that next/image is overkill; plain img keeps it static.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="h-9 w-9 object-contain rounded-sm" />
      ) : (
        <Building2 className="h-4 w-4 text-neutral-400" />
      )}
      {/* Name tooltip on hover */}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-neutral-700">
        {name}
      </span>
    </span>
  );
}
