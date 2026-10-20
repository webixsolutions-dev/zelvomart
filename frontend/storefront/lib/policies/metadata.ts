import { shareMeta } from "@store/lib/seo";
import type { Metadata } from "next";
import { site } from "@store/lib/site";
import type { PolicyDocument } from "./types";

export function policyMetadata(policy: PolicyDocument): Metadata {
  const url = `/${policy.slug}/`;
  return {
    title: policy.title,
    description: policy.subtitle,
    alternates: { canonical: url },
    ...shareMeta({ title: `${policy.title} | ${site.name}`, description: policy.subtitle, path: url }),
  };
}
