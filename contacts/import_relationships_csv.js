/*
 * Import relationships from a hand-maintained CSV into contacts.
 *
 *   node import_relationships_csv.js <file.csv> [--apply]
 *
 * Columns: Name, LinkedIn, strength, Skill, Notes, Rating, Companies
 *
 * Matches existing contacts by normalized full name and UPDATES them rather
 * than inserting a duplicate — the book already holds ~1,186 people and several
 * of these are likely in it. Only fields present in the CSV are written, so an
 * update never blanks data the CSV does not carry.
 *
 * Company names are normalized on the way in ("Handshake" -> "Handshake AI"),
 * so the sheet cannot reintroduce spellings that were standardized away.
 */
const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!FILE) {
  console.error("usage: node import_relationships_csv.js <file.csv> [--apply]");
  process.exit(1);
}

const WEB = path.resolve(__dirname, "..", "web");
const env = {};
for (const line of fs.readFileSync(path.join(WEB, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const H = {
  apikey: env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const list = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Canonical company spellings, so the sheet can't undo a standardization. */
const COMPANY_ALIASES = {
  handshake: "Handshake AI",
  "oppenheimer & co inc": "Oppenheimer",
  halo: "Halo",
  "powered by halo": "Halo",
  backcountry: "Backcountry Academics",
};
const canonCompany = (c) => COMPANY_ALIASES[String(c).toLowerCase().trim()] ?? c.trim();

/** The sheet says High/Medium/Low; contacts.strength_tier has five levels. */
const STRENGTH = { high: "strong", medium: "medium", med: "medium", low: "weak" };

function rating(v) {
  const s = String(v ?? "").trim();
  if (!s || /^no data$/i.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(10, Math.round(n)));
}

(async () => {
  const rows = parseCsv(fs.readFileSync(FILE, "utf8"));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const iName = col("name"), iLinked = col("linkedin"), iStrength = col("strength");
  const iSkill = col("skill"), iNotes = col("notes"), iRating = col("rating"), iCos = col("companies");
  if (iName === -1) throw new Error("no Name column");

  const parsed = [];
  for (const r of rows.slice(1)) {
    const name = String(r[iName] ?? "").trim();
    if (!name) continue;
    parsed.push({
      full_name: name,
      linkedin: (r[iLinked] ?? "").trim() || null,
      strength_tier: STRENGTH[String(r[iStrength] ?? "").trim().toLowerCase()] ?? null,
      skill_tags: list(r[iSkill]),
      notes: (r[iNotes] ?? "").trim() || null,
      competency: rating(r[iRating]),
      company_tags: list(r[iCos]).map(canonCompany),
    });
  }

  // Existing contacts, paged — a single select stops at 1000 and would make
  // everyone past that look new.
  const existing = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts?select=id,full_name,skill_tags,company_tags,competency,notes,linkedin,strength_tier`, {
      headers: { ...H, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`load contacts -> ${res.status}`);
    const batch = await res.json();
    existing.push(...batch);
    if (batch.length < 1000) break;
  }
  const byName = new Map();
  for (const c of existing) if (c.full_name) byName.set(norm(c.full_name), c);

  const inserts = [], updates = [];
  for (const p of parsed) {
    const hit = byName.get(norm(p.full_name));
    if (!hit) { inserts.push(p); continue; }
    // Only set what the CSV actually carries; never blank existing data.
    const patch = {};
    if (p.linkedin && !hit.linkedin) patch.linkedin = p.linkedin;
    if (p.strength_tier && (!hit.strength_tier || hit.strength_tier === "none")) patch.strength_tier = p.strength_tier;
    if (p.competency !== null && hit.competency === null) patch.competency = p.competency;
    if (p.notes && !hit.notes) patch.notes = p.notes;
    if (p.skill_tags.length) {
      const merged = [...new Set([...(hit.skill_tags ?? []), ...p.skill_tags])];
      if (merged.length !== (hit.skill_tags ?? []).length) patch.skill_tags = merged;
    }
    if (p.company_tags.length) {
      const merged = [...new Set([...(hit.company_tags ?? []), ...p.company_tags])];
      if (merged.length !== (hit.company_tags ?? []).length) patch.company_tags = merged;
    }
    if (Object.keys(patch).length) updates.push({ id: hit.id, name: p.full_name, patch });
    else updates.push({ id: hit.id, name: p.full_name, patch: null });
  }

  console.log(`===== ${APPLY ? "APPLY" : "DRY RUN"} =====`);
  console.log(`csv rows: ${parsed.length}   new: ${inserts.length}   existing: ${updates.length}\n`);
  console.log("--- NEW contacts ---");
  for (const p of inserts) {
    console.log(`  ${p.full_name.padEnd(22)} strength=${String(p.strength_tier).padEnd(6)} competency=${String(p.competency ?? "-").padStart(2)}  skills=${JSON.stringify(p.skill_tags)}  companies=${JSON.stringify(p.company_tags)}`);
  }
  console.log("\n--- EXISTING contacts ---");
  for (const u of updates) {
    console.log(`  ${u.name.padEnd(22)} ${u.patch ? JSON.stringify(u.patch) : "(nothing to add)"}`);
  }

  if (!APPLY) { console.log("\ndry run - nothing written. re-run with --apply"); return; }

  if (inserts.length) {
    const payload = inserts.map((p) => ({
      full_name: p.full_name,
      linkedin: p.linkedin,
      strength_tier: p.strength_tier ?? "none",
      skill_tags: p.skill_tags,
      company_tags: p.company_tags,
      // The sheet lists companies oldest-first, so [0] is a FORMER employer —
      // taking it made Alex Chiou "Instagram" when he is at Handshake. Prefer
      // the current employer when it is present, else the last listed.
      primary_company: p.company_tags.includes("Handshake AI")
        ? "Handshake AI"
        : p.company_tags[p.company_tags.length - 1] ?? null,
      competency: p.competency,
      notes: p.notes,
      tracked: true,
      priority: "medium",
      source: "wip-relationships-csv",
    }));
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts`, {
      method: "POST", headers: H, body: JSON.stringify(payload),
    });
    if (!res.ok) { console.error(`INSERT FAILED ${res.status}: ${await res.text()}`); process.exit(1); }
    console.log(`inserted ${(await res.json()).length}`);
  }
  let patched = 0;
  for (const u of updates) {
    if (!u.patch) continue;
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/contacts?id=eq.${u.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify(u.patch),
    });
    if (!res.ok) { console.error(`PATCH FAILED ${u.name}: ${res.status} ${await res.text()}`); process.exit(1); }
    patched++;
  }
  console.log(`updated ${patched}`);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
