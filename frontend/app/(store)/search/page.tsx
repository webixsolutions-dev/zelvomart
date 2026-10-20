import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { SearchView } from "@store/components/pages/SearchView";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default function Page() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Search" }]} />
      <Suspense fallback={<div className="container skeleton-block" />}>
        <SearchView />
      </Suspense>
    </>
  );
}
