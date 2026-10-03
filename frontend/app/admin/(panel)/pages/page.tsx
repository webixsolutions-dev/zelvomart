"use client";

import { useMemo, useState } from "react";
import AdminModal from "@/components/admin/AdminModal";
import { clientApi } from "@/lib/client-api";
import { AdminError, AdminLoading, clearAdminDataCache, useAdminData } from "@/components/admin/useAdminData";

type PageRow = {
  id?: string;
  slug: string;
  title: string;
  bodyHtml: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  published?: boolean;
};

const CORE_PAGES = [
  { slug: "blog", title: "Blog" },
  { slug: "about-us", title: "About Us" },
  { slug: "contact-us", title: "Contact" },
] as const;

const DEFAULT_BODY: Record<string, string> = {
  blog: "<h2>Zelvomart Blog</h2><p>Add shopping guides, product ideas and store updates here.</p>",
  "about-us": "<h2>About Zelvomart</h2><p>Tell customers what Zelvomart stands for and how you serve them.</p>",
  "contact-us": "<h2>Contact Zelvomart</h2><p>Add phone, WhatsApp, email, working hours and support information here.</p>",
};

function PageEditor({ page, onSaved }: { page: PageRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = {
        slug: page.slug,
        title: String(form.get("title") || page.title),
        bodyHtml: String(form.get("bodyHtml") || ""),
        seoTitle: String(form.get("seoTitle") || "") || null,
        seoDescription: String(form.get("seoDescription") || "") || null,
        published: form.get("published") === "on",
      };
      if (page.id) {
        await clientApi(`/api/admin/pages/${page.id}`, { method: "PATCH", body: JSON.stringify(payload) }, true);
      } else {
        await clientApi("/api/admin/pages", { method: "POST", body: JSON.stringify(payload) }, true);
      }
      clearAdminDataCache("/api/admin/pages");
      setMessage("Saved. Storefront content will refresh after revalidation.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message.replace(/_/g, " ") : "Unable to save page");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-reference-form" onSubmit={submit}>
      <label className="field"><span>Page title</span><input name="title" defaultValue={page.title} /></label>
      <label className="field"><span>Slug</span><input value={page.slug} readOnly /></label>
      <label className="field full"><span>Page content (HTML)</span><textarea name="bodyHtml" rows={16} defaultValue={page.bodyHtml} /></label>
      <label className="field"><span>SEO title</span><input name="seoTitle" defaultValue={page.seoTitle || ""} /></label>
      <label className="field"><span>SEO description</span><textarea name="seoDescription" rows={4} defaultValue={page.seoDescription || ""} /></label>
      <label className="admin-check full"><input type="checkbox" name="published" defaultChecked={page.published !== false} /> Published</label>
      {message ? <p className="full" style={{ margin: 0, fontSize: 12 }}>{message}</p> : null}
      <button className="admin-reference-submit" disabled={saving}>{saving ? "Saving…" : "Save Page"}</button>
    </form>
  );
}

export default function PagesAdmin() {
  const { data, loading, error, reload } = useAdminData<PageRow[]>("/api/admin/pages", []);
  const rows = useMemo(() => new Map((data || []).map((page) => [page.slug, page])), [data]);
  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  return (
    <>
      <div className="admin-title">
        <div><span className="admin-eyebrow">STOREFRONT CONTENT</span><h1>Pages</h1><p>Edit Blog, About Us and Contact without changing frontend code. Shop remains database-driven from Products and Categories.</p></div>
      </div>
      <div className="admin-settings-grid">
        {CORE_PAGES.map((item) => {
          const existing = rows.get(item.slug);
          const page: PageRow = existing || { slug: item.slug, title: item.title, bodyHtml: DEFAULT_BODY[item.slug], published: true };
          return (
            <div className="admin-settings-card" key={item.slug}>
              <span className="admin-settings-icon">▤</span>
              <h2>{item.title}</h2>
              <p>{existing ? "Connected to the database and editable." : "Not in the database yet. Saving will create it."}</p>
              <AdminModal trigger="Edit Page" triggerClassName="admin-btn admin-btn-light" title={`Edit ${item.title}`} size="lg">
                <PageEditor page={page} onSaved={reload} />
              </AdminModal>
            </div>
          );
        })}
      </div>
    </>
  );
}
