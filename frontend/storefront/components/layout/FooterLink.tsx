"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

/** Footer destinations open with the full header visible, without scrolling up through the old page. */
export function FooterLink(
  props: Omit<ComponentProps<typeof Link>, "onNavigate" | "scroll">,
) {
  return <Link {...props} />;
}
