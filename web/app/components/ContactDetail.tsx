"use client";

import { useEffect } from "react";
import type { Contact } from "@/lib/types";
import { displayName } from "@/lib/stats";

export function ContactDetail({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const name = displayName(contact);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            {contact.organization && (
              <div className="text-sm text-neutral-500">
                {contact.job_title ? `${contact.job_title} · ` : ""}
                {contact.organization}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-5 text-sm">
          {contact.phones.length > 0 && (
            <Section title="Phones">
              {contact.phones.map((p, i) => (
                <Row key={i} label={p.label} value={<a href={`tel:${p.value}`}>{p.value}</a>} mono />
              ))}
            </Section>
          )}
          {contact.emails.length > 0 && (
            <Section title="Emails">
              {contact.emails.map((e, i) => (
                <Row key={i} label={e.label} value={<a href={`mailto:${e.value}`}>{e.value}</a>} mono />
              ))}
            </Section>
          )}
          {contact.urls.length > 0 && (
            <Section title="URLs">
              {contact.urls.map((u, i) => (
                <Row
                  key={i}
                  label={u.label}
                  value={
                    <a href={u.value} target="_blank" rel="noopener noreferrer">
                      {u.value}
                    </a>
                  }
                  mono
                />
              ))}
            </Section>
          )}
          {contact.addresses.length > 0 && (
            <Section title="Addresses">
              {contact.addresses.map((a, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-16 shrink-0 text-neutral-500">{a.label}</div>
                  <div className="text-neutral-800 dark:text-neutral-200">
                    {[a.street, a.city, a.region, a.postal, a.country].filter(Boolean).join(", ")}
                  </div>
                </div>
              ))}
            </Section>
          )}
          {(contact.birthday || contact.anniversary) && (
            <Section title="Dates">
              {contact.birthday && <Row label="Birthday" value={contact.birthday} />}
              {contact.anniversary && <Row label="Anniv." value={contact.anniversary} />}
            </Section>
          )}
          {contact.categories.length > 0 && (
            <Section title="Categories">
              <div className="flex flex-wrap gap-1.5">
                {contact.categories.map((cat) => (
                  <span
                    key={cat}
                    className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {contact.related.length > 0 && (
            <Section title="Related">
              {contact.related.map((r, i) => (
                <Row key={i} label={r.label} value={r.value} />
              ))}
            </Section>
          )}
          {contact.notes && (
            <Section title="Notes">
              <pre className="whitespace-pre-wrap font-sans text-neutral-700 dark:text-neutral-300">
                {contact.notes}
              </pre>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1.5">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-16 shrink-0 text-neutral-500">{label}</div>
      <div className={`text-neutral-800 dark:text-neutral-200 ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
