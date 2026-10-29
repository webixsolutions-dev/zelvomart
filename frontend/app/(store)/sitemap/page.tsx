import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { loadSeoIndex } from "@store/lib/backend";
import { site } from "@store/lib/site";
import { childSitemaps, sitemapData, type SitemapData, type SitemapUrl } from "@store/lib/sitemaps";
import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";
import { PageIntro } from "@store/components/home/Blocks";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Sitemap",
  description: "Every page, category and product on Zelvomart, in one list.",
  alternates: { canonical: "/sitemap/" },
  // Crawlers follow the links; the page itself stays out of search results.
  robots: { index: false, follow: true },
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" });
const path = (u: SitemapUrl) => new URL(u.loc).pathname;

function Count({ n }: { n: number }) {
  return <span className="sitemap-count">{n}</span>;
}

export default async function Page() {
  let data: SitemapData | null = null;
  try {
    data = sitemapData(await loadSeoIndex());
  } catch (error) {
    unstable_rethrow(error);
    // Backend down or an answer of the wrong shape: a short notice instead of wrong lists.
    data = null;
  }
  const children = data ? childSitemaps(data) : [];
  const updated = children.reduce((a, c) => (c.lastmod > a ? c.lastmod : a), "");
  const uncategorised = data ? data.products.filter((p) => !p.categoryId) : [];

  return (
    <>
      <Breadcrumbs items={[{ label: "Sitemap" }]} />
      <PageIntro eyebrow="Help centre" title="Sitemap" sub="Every page, category and product on Zelvomart." />
      <section className="section pt-sm">
        <div className="container-narrow sitemap-page">
          {!data ? (
            <p>The sitemap is updating. Please try again in a few minutes.</p>
          ) : (
            <>
              <p className="sitemap-summary">
                <strong>Pages {data.pages.length}</strong> · <strong>Categories {data.categories.length}</strong> ·{" "}
                <strong>Products {data.products.length}</strong>
                {updated && <span> · Last updated {day(updated)}</span>}
              </p>

              <div className="sitemap-group">
                <h2>
                  Pages <Count n={data.pages.length} />
                </h2>
                <ul className="sitemap-list">
                  {data.pages.map((p) => (
                    <li key={p.loc}>
                      <Link href={path(p)} prefetch={false}>
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sitemap-group">
                <h2>
                  Categories <Count n={data.categories.length} />
                </h2>
                <ul className="sitemap-list">
                  {data.categories.map((c) => (
                    <li key={c.loc}>
                      <Link href={path(c)} prefetch={false}>
                        {c.name}
                      </Link>{" "}
                      <span className="sitemap-muted">
                        ({c.productCount} {c.productCount === 1 ? "product" : "products"})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="sitemap-group">
                <h2>
                  Products <Count n={data.products.length} />
                </h2>
                {data.categories.map((c) => {
                  const items = data.products.filter((p) => p.categoryId === c.id);
                  if (!items.length) return null;
                  return (
                    <div className="sitemap-subgroup" key={c.id}>
                      <h3>
                        <Link href={path(c)} prefetch={false}>
                          {c.name}
                        </Link>{" "}
                        <Count n={items.length} />
                      </h3>
                      <ul className="sitemap-list">
                        {items.map((p) => (
                          <li key={p.loc}>
                            <Link href={path(p)} prefetch={false}>
                              {p.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
                {uncategorised.length > 0 && (
                  <div className="sitemap-subgroup">
                    <h3>
                      Other products <Count n={uncategorised.length} />
                    </h3>
                    <ul className="sitemap-list">
                      {uncategorised.map((p) => (
                        <li key={p.loc}>
                          <Link href={path(p)} prefetch={false}>
                            {p.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="sitemap-group sitemap-xml">
                <h2>For search engines</h2>
                <p>
                  The sitemap index is <a href={`${site.url}/sitemap_index.xml`}>{`${site.url}/sitemap_index.xml`}</a>. It lists:
                </p>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Sitemap</th>
                      <th scope="col">URLs</th>
                      <th scope="col">Last modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((c) => (
                      <tr key={c.file}>
                        <td>
                          <a href={`/${c.file}`}>{c.file}</a>
                        </td>
                        <td>{c.urls.length}</td>
                        <td>{day(c.lastmod)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
