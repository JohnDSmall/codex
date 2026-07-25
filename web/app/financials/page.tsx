import { redirect } from "next/navigation";

/** Financials was renamed to Ephemeris; keep old links working. */
export default function FinancialsPage() {
  redirect("/ephemeris");
}
