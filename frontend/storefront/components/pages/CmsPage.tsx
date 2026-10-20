import { Breadcrumbs } from "@store/components/ui/Breadcrumbs";

/** A page written in Admin → Pages, shown inside the storefront's layout. */
export function CmsPage({ title, bodyHtml }: { title: string; bodyHtml: string }) {
  return (
    <>
      <Breadcrumbs items={[{ label: title }]} />
      <section className="section pt-sm">
        <div className="container-narrow">
          <h1>{title}</h1>
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </div>
      </section>
    </>
  );
}
