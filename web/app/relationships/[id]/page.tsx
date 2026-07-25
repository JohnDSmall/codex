import Link from "next/link";
import { notFound } from "next/navigation";
import { loadContactById } from "@/lib/contacts-server";
import { DeleteRelationshipButton } from "../../components/DeleteRelationshipButton";
import {
  cardCompanies,
  daysToContact,
  displayName,
  formatDateLong,
  formatTimestamp,
  primaryCompany,
  strengthBadgeClass,
  strengthLabel,
} from "@/lib/relationship";
import { logoForCompany } from "@/lib/company-logos";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckSquare,
  Clock,
  Gift,
  Globe,
  Link as LinkIcon,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Tag,
  Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RelationshipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await loadContactById(id);
  if (!contact) notFound();

  const name = displayName(contact);
  const company = primaryCompany(contact);
  const days = daysToContact(contact);
  const tier = contact.strength_tier;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/relationships"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Relationships
        </Link>
        <div className="flex items-center gap-2">
          <DeleteRelationshipButton id={contact.id} name={name} />
          <Link
            href={`/relationships/${contact.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Link>
        </div>
      </div>

      <header className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{name}</h1>
            {(contact.job_title || company) && (
              <p className="mt-1 text-sm text-neutral-500">
                {contact.job_title}
                {contact.job_title && company ? " · " : ""}
                {company}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {tier !== "none" && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${strengthBadgeClass(tier)}`}>
                  {strengthLabel(tier)}
                </span>
              )}
              <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
                Priority: {contact.priority}
              </span>
              {contact.tracked && (
                <span className="rounded-full bg-indigo-100 dark:bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                  Tracked
                </span>
              )}
            </div>
          </div>
          {days !== null && (
            <div
              className={`rounded-xl px-4 py-3 text-center min-w-[100px] ${
                days < 0
                  ? "bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300"
                  : days <= 7
                  ? "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <div className="text-2xl font-semibold tabular-nums">{Math.abs(days)}</div>
              <div className="text-[10px] uppercase tracking-wider">{days < 0 ? "overdue" : "days"}</div>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card title="Reminders" icon={<Bell className="w-4 h-4" />}>
            {contact.reminders.length > 0 ? (
              <ul className="space-y-2">
                {contact.reminders.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckSquare className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-400">No reminders set.</p>
            )}
          </Card>

          <Card title="Timeline" icon={<Clock className="w-4 h-4" />}>
            {contact.timeline_notes.length > 0 ? (
              <div className="space-y-3">
                {contact.timeline_notes
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((n, i) => (
                    <div key={i} className="border-l-2 border-indigo-200 dark:border-indigo-500/40 pl-3">
                      <div className="text-xs font-medium text-neutral-500">{formatDateLong(n.date)}</div>
                      <div className="text-sm mt-0.5 whitespace-pre-wrap">{n.content}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No timeline notes yet.</p>
            )}
          </Card>

          {contact.notes && (
            <Card title="Notes" icon={<Tag className="w-4 h-4" />}>
              <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700 dark:text-neutral-300">
                {contact.notes}
              </pre>
            </Card>
          )}

          {(contact.connection_source ||
            contact.looking_for ||
            contact.connection_tags.length > 0 ||
            contact.interest_tags.length > 0 ||
            contact.university_tags.length > 0) && (
            <Card title="Profile" icon={<Tag className="w-4 h-4" />}>
              <div className="space-y-3 text-sm">
                {contact.connection_source && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">How we connected</div>
                    <div>{contact.connection_source}</div>
                  </div>
                )}
                {contact.looking_for && (
                  <div>
                    <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Looking for</div>
                    <div className="whitespace-pre-wrap">{contact.looking_for}</div>
                  </div>
                )}
                {contact.connection_tags.length > 0 && (
                  <TagRow label="Tags" items={contact.connection_tags} />
                )}
                {contact.interest_tags.length > 0 && (
                  <TagRow label="Interests" items={contact.interest_tags} />
                )}
                {contact.university_tags.length > 0 && (
                  <TagRow label="Universities" items={contact.university_tags} />
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card title="Contact" icon={<Phone className="w-4 h-4" />}>
            <dl className="space-y-2 text-sm">
              {contact.phones.map((p, i) => (
                <Row key={`p${i}`} label={p.label} icon={<Phone className="w-3.5 h-3.5" />}>
                  <a href={`tel:${p.value}`} className="font-mono">{p.value}</a>
                </Row>
              ))}
              {contact.emails.map((e, i) => (
                <Row key={`e${i}`} label={e.label} icon={<Mail className="w-3.5 h-3.5" />}>
                  <a href={`mailto:${e.value}`} className="font-mono break-all">{e.value}</a>
                </Row>
              ))}
              {contact.linkedin && (
                <Row label="LinkedIn" icon={<LinkIcon className="w-3.5 h-3.5" />}>
                  <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="break-all">
                    {contact.linkedin}
                  </a>
                </Row>
              )}
              {contact.urls.map((u, i) => (
                <Row key={`u${i}`} label={u.label} icon={<Globe className="w-3.5 h-3.5" />}>
                  <a href={u.value} target="_blank" rel="noopener noreferrer" className="break-all">
                    {u.value}
                  </a>
                </Row>
              ))}
              {contact.phones.length === 0 && contact.emails.length === 0 && !contact.linkedin && contact.urls.length === 0 && (
                <p className="text-sm text-neutral-400">No contact info.</p>
              )}
            </dl>
          </Card>

          {contact.addresses.length > 0 && (
            <Card title="Addresses" icon={<MapPin className="w-4 h-4" />}>
              {contact.addresses.map((a, i) => (
                <Row key={i} label={a.label}>
                  <div>
                    {[a.street, a.city, a.region, a.postal, a.country].filter(Boolean).join(", ")}
                  </div>
                </Row>
              ))}
            </Card>
          )}

          <Card title="Dates" icon={<Calendar className="w-4 h-4" />}>
            <Row label="Last contact">{formatDateLong(contact.last_contact_date) ?? "—"}</Row>
            <Row label="Next contact">{formatDateLong(contact.target_contact_date) ?? "—"}</Row>
            <Row label="Frequency">{contact.contact_frequency ?? "—"}</Row>
            {contact.birthday && (
              <Row label="Birthday" icon={<Gift className="w-3.5 h-3.5" />}>{formatDateLong(contact.birthday)}</Row>
            )}
            {contact.anniversary && (
              <Row label="Anniversary">{formatDateLong(contact.anniversary)}</Row>
            )}
          </Card>

          {cardCompanies(contact).length > 0 && (
            <Card title="Companies" icon={<Users className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {cardCompanies(contact).map((c) => {
                  const logo = logoForCompany(c);
                  return (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-1 text-xs"
                    >
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="w-4 h-4 object-contain rounded-sm" />
                      ) : null}
                      {c}
                    </span>
                  );
                })}
              </div>
            </Card>
          )}

          {contact.categories.length > 0 && (
            <Card title="Categories" icon={<Tag className="w-4 h-4" />}>
              <div className="flex flex-wrap gap-1.5">
                {contact.categories.map((c) => (
                  <span key={c} className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </Card>
          )}

          <Card title="Record" icon={<Clock className="w-4 h-4" />}>
            <Row label="Created">{formatTimestamp(contact.imported_at) ?? "—"}</Row>
            <Row label="Last updated">{formatTimestamp(contact.updated_at) ?? "—"}</Row>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
      <h2 className="flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function TagRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 text-sm py-1">
      <div className="w-24 shrink-0 text-neutral-500 capitalize flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-neutral-800 dark:text-neutral-200 min-w-0 break-words">{children}</div>
    </div>
  );
}
