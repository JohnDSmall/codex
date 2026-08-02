import "server-only";
import { supabaseAdmin } from "./supabase-server";
import { buildCompanyLogoMap, type CompanyLogoMap, type CompanyLogoRow } from "./company-logos";

/**
 * Load the company → logo lookup from Supabase.
 *
 * Logos are decoration: a failure here must never take down a page that is
 * otherwise fine, so this returns an empty map instead of throwing. Callers
 * then render the Building2 placeholder, same as an unknown company.
 */
export async function loadCompanyLogoMap(): Promise<CompanyLogoMap> {
  const { data, error } = await supabaseAdmin
    .from("companies")
    .select("company_id,display_name,logo_path");
  if (error) {
    console.error("loadCompanyLogoMap: falling back to no logos —", error.message);
    return {};
  }
  return buildCompanyLogoMap((data ?? []) as CompanyLogoRow[]);
}
