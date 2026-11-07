"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

function CategoryStatus() {
  const { pending } = useLinkStatus();
  return <span className="sr-only" role="status">{pending ? "Opening category" : ""}</span>;
}

/** Fetch the intended category without downloading every product grid on a first mobile visit. */
export function CategoryLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const prefetch = () => router.prefetch(href);
  return (
    <Link href={href} className={className} prefetch={false} onMouseEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch}>
      {children}
      <CategoryStatus />
    </Link>
  );
}
