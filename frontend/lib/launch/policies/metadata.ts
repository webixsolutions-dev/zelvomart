import type { Metadata } from "next";
import { site } from "@/lib/launch/site";
import type { PolicyDocument } from "./types";

export function policyMetadata(policy: PolicyDocument): Metadata {
  const url = `/${policy.slug}/`;
  return {
    title: policy.title,
    description: policy.subtitle,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: site.locale,
      title: policy.title,
      description: policy.subtitle,
      url,
      images: [{ url: "/launch/brand/og-zelvomart.jpg", width: 1200, height: 630, alt: site.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: policy.title,
      description: policy.subtitle,
      images: ["/launch/brand/og-zelvomart.jpg"],
    },
  };
}
