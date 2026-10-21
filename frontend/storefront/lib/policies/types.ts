export type PolicySlug = "refund_returns" | "shipping-policy" | "terms-conditions" | "privacy-policy";

export type PolicyIcon =
  | "return" | "heart" | "video" | "check" | "cross" | "message"
  | "clock" | "mail" | "truck" | "pin" | "package" | "cash"
  | "document" | "tag" | "clipboard" | "copyright" | "scale"
  | "shield" | "database" | "share" | "lock" | "user" | "refresh";

export type PolicySection = {
  heading: string;
  /** Supplied copy. Only Markdown links are interpreted; all other text is literal. A blank line starts a new paragraph. */
  body: string;
  icon: PolicyIcon;
  half?: boolean;
  tone?: "primary" | "soft" | "callout" | "contact" | "subtle";
};

export type PolicyDocument = {
  slug: PolicySlug;
  title: string;
  subtitle: string;
  icon: PolicyIcon;
  sections: PolicySection[];
  /** When the Admin page was last saved (ISO); the file date is used when there is no page yet. */
  updatedAt?: string;
};
