export type PhoneEntry = { label: string; value: string };
export type EmailEntry = { label: string; value: string };
export type UrlEntry = { label: string; value: string };
export type SocialEntry = { service: string; value: string };
export type RelatedEntry = { label: string; value: string };
export type AddressEntry = {
  label: string;
  po_box?: string | null;
  extended?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
};

export type StrengthTier = "strong" | "medium" | "weak" | "loose" | "none";
export type Priority = "high" | "medium" | "low";
export type ContactFrequency = "weekly" | "monthly" | "quarterly" | "biannually" | "yearly" | null;
export type TimelineNote = { date: string; content: string };

export type Contact = {
  id: string;
  uid: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  prefix: string | null;
  suffix: string | null;
  nickname: string | null;
  organization: string | null;
  job_title: string | null;
  department: string | null;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  addresses: AddressEntry[];
  urls: UrlEntry[];
  social: SocialEntry[];
  related: RelatedEntry[];
  birthday: string | null;
  anniversary: string | null;
  notes: string | null;
  categories: string[];
  imported_at: string;
  updated_at: string;

  // Relationship overlay
  strength_tier: StrengthTier;
  priority: Priority;
  follow_up_fl: boolean;
  last_contact_date: string | null;
  target_contact_date: string | null;
  contact_frequency: ContactFrequency;
  reminders: string[];
  timeline_notes: TimelineNote[];
  tracked: boolean;
  linkedin: string | null;
  primary_company: string | null;
  company_tags: string[];
  connection_tags: string[];
  interest_tags: string[];
  university_tags: string[];
  connection_source: string | null;
  looking_for: string | null;
  added_date: string | null;
};
