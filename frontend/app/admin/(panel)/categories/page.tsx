"use client";

import { useEffect, useState } from "react";
import AdminModal from "@/components/admin/AdminModal";
import { AdminError, AdminLoading, clearAdminDataCache, useAdminData } from "@/components/admin/useAdminData";
import { clientApi } from "@/lib/client-api";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
  imageUrl?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt?: string;
  count?: number;
};

function emptyOptional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function CategoryForm({ initial, onSaved }: { initial?: CategoryRow; onSaved: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? "");
    setSlug(initial?.slug ?? "");
    setSortOrder(String(initial?.sortOrder ?? 0));
    setImageUrl(initial?.imageUrl ?? "");
    setDescription(initial?.description ?? "");
    setSeoTitle(initial?.seoTitle ?? "");
    setSeoDescription(initial?.seoDescription ?? "");
    setError("");
  }, [initial?.id, initial?.updatedAt]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      sortOrder: Number(sortOrder || 0),
      imageUrl: emptyOptional(imageUrl),
      description: emptyOptional(description),
      seoTitle: emptyOptional(seoTitle),
      seoDescription: emptyOptional(seoDescription),
    };
    try {
      await clientApi(
        initial ? `/api/admin/categories/${initial.id}` : "/api/admin/categories",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) },
        true,
      );
      clearAdminDataCache("/api/admin/categories");
      onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-reference-form" onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">
        <span>Slug</span>
        <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} required />
      </label>
      <label className="field">
        <span>Sort order</span>
        <input name="sortOrder" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </label>
      <label className="field">
        <span>Image URL</span>
        <input name="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
      </label>
      <label className="field full">
        <span>Description</span>
        <textarea name="description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span>SEO title</span>
        <input name="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>SEO description</span>
        <textarea name="seoDescription" rows={3} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
      </label>
      {error ? <div className="admin-import-message error">{error}</div> : null}
      <button className="admin-reference-submit" type="submit" disabled={saving}>
        {saving ? "Saving…" : initial ? "Save Category" : "Add Category"}
      </button>
    </form>
  );
}

export default function Categories() {
  const { data, loading, error, reload } = useAdminData<CategoryRow[]>("/api/admin/categories", []);

  if (loading) return <AdminLoading />;
  if (error) return <AdminError message={error} />;

  async function del(id: string) {
    if (!confirm("Delete category?")) return;
    await clientApi(`/api/admin/categories/${id}`, { method: "DELETE" }, true);
    clearAdminDataCache("/api/admin/categories");
    reload();
  }

  function afterSave() {
    clearAdminDataCache("/api/admin/categories");
    void reload();
  }

  return (
    <>
      <div className="admin-title">
        <div>
          <h1>Categories</h1>
          <p>Create, order, image and SEO fields.</p>
        </div>
        <AdminModal trigger={<>＋ Add Category</>} title="Add Category">
          <CategoryForm key="add-category" onSaved={afterSave} />
        </AdminModal>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Products</th>
              <th>Sort</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>{c.count || 0}</td>
                <td>{c.sortOrder}</td>
                <td>
                  <div className="admin-head-actions">
                    <AdminModal trigger="Edit" triggerClassName="admin-btn admin-btn-light" title={`Edit ${c.name}`}>
                      <CategoryForm key={`${c.id}:${c.updatedAt ?? ""}`} initial={c} onSaved={afterSave} />
                    </AdminModal>
                    <button className="admin-btn admin-row-action-danger" type="button" onClick={() => del(c.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
