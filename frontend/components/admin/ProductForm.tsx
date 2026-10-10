"use client";

import { FormEvent, useMemo, useRef, useState, useEffect } from "react";
import AdminRichTextEditor from "./AdminRichTextEditor";
import { clientApi } from "@/lib/client-api";

type Category = { id: string; name: string };

export type VariantItem = {
  id?: string;
  name: string;
  sku: string;
  stock: number;
  priceOverride?: number | null;
  imageUrl?: string | null;
};

type ProductFormProps = {
  categories: Category[];
  initial?: any;
  onSaved?: (product?: any) => void;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-form-section admin-ls-section">
      <div className="admin-form-section-head">
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <div className="admin-ls-section-body">{children}</div>
    </section>
  );
}

export default function ProductForm({ categories, initial, onSaved }: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const variantFileRef = useRef<HTMLInputElement>(null);

  const initialImages = useMemo<string[]>(
    () =>
      (
        initial?.rawImages ||
        initial?.images?.map((image: any) =>
          typeof image === "string" ? image : image?.src
        ) ||
        []
      ).filter(Boolean),
    [initial]
  );

  // --- Core Form State ---
  const [title, setTitle] = useState(initial?.title || initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [status, setStatus] = useState(initial?.status || "DRAFT");
  const [images, setImages] = useState<string[]>(initialImages.slice(0, 10));
  const [manualImage, setManualImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState("");
  const [skuError, setSkuError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [focusKeyword, setFocusKeyword] = useState(initial?.focusKeyword || "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription || "");

  // --- Color Variants State ---
  const [variants, setVariants] = useState<VariantItem[]>(initial?.variants || []);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);

  // Variant Modal Fields
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantStock, setVariantStock] = useState<number>(100);
  const [variantPriceOverride, setVariantPriceOverride] = useState<string>("");
  const [variantImageUrl, setVariantImageUrl] = useState<string>("");
  const [variantUploadBusy, setVariantUploadBusy] = useState(false);

  // SEO Calculation
  const publishedSlugLocked = Boolean(initial && initial.status === "PUBLISHED");
  const seoPreviewTitle = seoTitle.trim() || title.trim() || "Product title";
  const seoPreviewDescription =
    seoDescription.trim() ||
    "Add a meta description to control how this product appears in search results.";
  const normalizedKeyword = focusKeyword.trim().toLowerCase();

  const seoChecks = useMemo(() => {
    const effectiveTitle = seoPreviewTitle.toLowerCase();
    const description = seoDescription.trim();
    const normalizedSlug = slug.toLowerCase();
    const checks = [
      seoPreviewTitle.trim().length > 0 && seoPreviewTitle.trim().length <= 60,
      description.length >= 70 && description.length <= 160,
      normalizedKeyword.length >= 2,
      Boolean(normalizedKeyword && effectiveTitle.includes(normalizedKeyword)),
      Boolean(normalizedKeyword && description.toLowerCase().includes(normalizedKeyword)),
      Boolean(normalizedKeyword && normalizedSlug.includes(slugify(normalizedKeyword))),
      title.trim().length >= 20,
      images.length > 0,
      Boolean(slug.trim()),
    ];
    const passed = checks.filter(Boolean).length;
    return { passed, total: checks.length, score: Math.round((passed / checks.length) * 100) };
  }, [seoPreviewTitle, seoDescription, normalizedKeyword, slug, title, images.length]);

  const seoStatus =
    seoChecks.score >= 80 ? "Great" : seoChecks.score >= 60 ? "Good" : "Needs Work";

  // Auto-generate title slug & unique base SKU
  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched && !publishedSlugLocked) {
      setSlug(slugify(value));

      // Auto-generate clean unique base SKU if creating a new product
      if (!initial) {
        const skuInput = formRef.current?.elements.namedItem("sku") as HTMLInputElement;
        if (skuInput && (!skuInput.value || skuInput.value.startsWith("ZVM-") || skuInput.value === "ZVM-0001")) {
          const prefix = value.trim()
            ? value.trim().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X")
            : "PROD";
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          skuInput.value = `ZVM-${prefix}-${randomNum}`;
          setSkuError("");
        }
      }
    }
  }

  // --- Variant Handlers ---
  function openAddVariantModal() {
    setEditingVariantIndex(null);
    setVariantName("");
    const baseSku = (formRef.current?.elements.namedItem("sku") as HTMLInputElement)?.value || "ZVM";
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    setVariantSku(`${baseSku}-V${variants.length + 1}-${randomSuffix}`);
    setVariantStock(100);
    setVariantPriceOverride("");
    setVariantImageUrl(images[0] || "");
    setIsVariantModalOpen(true);
  }

  function openEditVariantModal(index: number) {
    const item = variants[index];
    setEditingVariantIndex(index);
    setVariantName(item.name);
    setVariantSku(item.sku);
    setVariantStock(item.stock);
    setVariantPriceOverride(item.priceOverride != null ? String(item.priceOverride) : "");
    setVariantImageUrl(item.imageUrl || "");
    setIsVariantModalOpen(true);
  }

  function selectGalleryImageForVariant(url: string) {
    setVariantImageUrl(url);
  }

  function handleSaveVariant() {
    const cleanName = variantName.trim();
    if (!cleanName) {
      alert("Please enter a color name (e.g., Pink, Light Blue, White)");
      return;
    }

    // Prevent duplicate color names within the same product
    const exists = variants.some(
      (v, i) => i !== editingVariantIndex && v.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      alert(`A variant for color "${cleanName}" already exists.`);
      return;
    }

    const baseSku = (formRef.current?.elements.namedItem("sku") as HTMLInputElement)?.value || "ZVM";
    const cleanSku =
      variantSku.trim() ||
      `${baseSku}-${cleanName.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${Math.floor(100 + Math.random() * 900)}`;

    const newVariantItem: VariantItem = {
      ...(editingVariantIndex !== null ? variants[editingVariantIndex] : {}),
      name: cleanName,
      sku: cleanSku,
      stock: Number(variantStock || 0),
      priceOverride: variantPriceOverride.trim() ? Number(variantPriceOverride) : null,
      imageUrl: variantImageUrl.trim() || images[0] || null,
    };

    if (editingVariantIndex !== null) {
      setVariants((curr) => curr.map((v, i) => (i === editingVariantIndex ? newVariantItem : v)));
    } else {
      setVariants((curr) => [...curr, newVariantItem]);
    }

    setIsVariantModalOpen(false);
  }

  function handleDeleteVariant(index: number) {
    setVariants((current) => current.filter((_, i) => i !== index));
  }

  async function uploadVariantImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;

    setVariantUploadBusy(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await clientApi<{ url: string }>("/api/admin/upload", {
        method: "POST",
        body: data,
      }, true);
      const url = (res as any)?.url || (res as any)?.data?.url;
      if (url) {
        setVariantImageUrl(url);
        setImages((curr) => Array.from(new Set([...curr, url])));
      }
    } catch (err: any) {
      alert(err?.message || "Failed to upload image to Cloudflare R2");
    } finally {
      setVariantUploadBusy(false);
    }
  }

  // --- Save / Submit Form ---
  async function saveForm(targetStatus?: "DRAFT" | "PUBLISHED") {
    const form = formRef.current;
    if (!form || busy) return;
    if (!form.reportValidity()) return;

    setBusy(true);
    setError("");
    setSkuError("");
    setSavedMessage("");
    const formData = new FormData(form);
    const nextStatus = targetStatus || status;

    const payload: any = {
      title: title.trim(),
      slug: slug.trim(),
      sku: String(formData.get("sku") || "").trim(),
      categoryId: formData.get("categoryId") || null,
      price: Number(formData.get("price") || 0),
      salePrice: formData.get("salePrice") ? Number(formData.get("salePrice")) : null,
      costPrice: formData.get("costPrice") ? Number(formData.get("costPrice")) : null,
      stock: Number(formData.get("stock") || 0),
      status: nextStatus,
      featured: formData.get("featured") === "on",
      bundleEnabled: formData.get("bundleEnabled") === "on",
      bundleDiscountPercent: formData.get("bundleDiscountPercent")
        ? Number(formData.get("bundleDiscountPercent"))
        : null,
      shortDescription: formData.get("shortDescription") || null,
      descriptionHtml: formData.get("descriptionHtml") || null,
      images,
      videoUrl: formData.get("videoUrl") || null,
      seoTitle: formData.get("seoTitle") || null,
      seoDescription: formData.get("seoDescription") || null,
      canonicalUrl: formData.get("canonicalUrl") || null,
      focusKeyword: focusKeyword.trim() || null,
      variants, // Full variant list with linked R2 images
    };

   // ProductForm.tsx (Inside saveForm)
    try {
      const product = await clientApi<any>(
        initial ? `/api/admin/products/${initial.id}` : "/api/admin/products",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) },
        true
      );
      setStatus(nextStatus);
      setSavedMessage(
        nextStatus === "PUBLISHED"
          ? "Product published successfully."
          : "Draft saved successfully."
      );
      onSaved?.(product);
    } catch (requestError: any) {
      const errMsg =
        requestError?.error ||
        requestError?.message ||
        (requestError instanceof Error ? requestError.message : "Save failed");

      // FIX: Only assign to skuError if the backend specifically flagged the SKU field
      if (requestError?.field === "sku") {
        setSkuError(errMsg);
      } else if (requestError?.field === "slug") {
        setError(`Slug collision: "${slug}" already exists. Please choose a different slug.`);
      } else {
        // All other general errors appear in the standard error banner at the bottom
        setError(errMsg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveForm();
  }

  async function uploadImages(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    event.target.value = "";
    if (!files.length) return;
    const available = Math.max(0, 10 - images.length);
    if (!available) {
      setError("Maximum 10 product images are allowed.");
      return;
    }

    setUploadBusy(true);
    setError("");
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, available)) {
        const data = new FormData();
        data.append("file", file);
        const response = await clientApi<{ url: string }>(
          "/api/admin/upload",
          { method: "POST", body: data },
          true
        );
        const url = (response as any)?.url || (response as any)?.data?.url;
        if (url) uploaded.push(url);
      }
      setImages((current) => Array.from(new Set([...current, ...uploaded])).slice(0, 10));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Image upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  function addManualImage() {
    const value = manualImage.trim();
    if (!value || images.length >= 10) return;
    setImages((current) => Array.from(new Set([...current, value])).slice(0, 10));
    setManualImage("");
  }

  return (
    <>
      <form
        ref={formRef}
        className="admin-product-form admin-product-form-reference admin-ls-product-form"
        onSubmit={submit}
      >
        <div className="admin-product-form-intro">
          <div>
            <h2>{initial ? "Edit Product" : "Add Product"}</h2>
            <p>
              {initial
                ? "Update product details, pricing, media, variants and SEO."
                : "Create a new Zelvomart product with variants and zero-egress media."}
            </p>
          </div>
        </div>

        <div className="admin-product-form-grid admin-product-form-grid-reference">
          <div className="admin-product-main">
            {/* Basics */}
            <SectionCard
              title="Basics"
              description="Core product information shown across the storefront and catalog."
            >
              <div className="admin-reference-form admin-ls-form-grid">
                <label className="field full">
                  <span>Product Title <em>*</em></span>
                  <input
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="e.g. 1200ML Insulated Tumbler with Handle"
                    required
                  />
                </label>
                <label className="field">
                  <span>
                    Slug{" "}
                    {publishedSlugLocked ? <small className="admin-locked-label">Locked</small> : null}
                  </span>
                  <input
                    value={slug}
                    readOnly={publishedSlugLocked}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(slugify(event.target.value));
                    }}
                    placeholder="auto-generated-from-title"
                    required
                  />
                  <small>
                    {publishedSlugLocked
                      ? "Published slug is locked to protect SEO."
                      : "Auto-fills from the title until you edit it."}
                  </small>
                </label>
                <label className="field">
                  <span>SKU <em>*</em></span>
                  <input
                    name="sku"
                    defaultValue={initial?.sku || ""}
                    onChange={() => setSkuError("")}
                    style={{
                      borderColor: skuError ? "#ef4444" : undefined,
                      backgroundColor: skuError ? "#fef2f2" : undefined,
                    }}
                    placeholder="ZVM-0001"
                    required
                  />
                  {skuError ? (
                    <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 600, marginTop: "4px" }}>
                      ⚠ {skuError}
                    </span>
                  ) : (
                    <small>Unique code for inventory tracking.</small>
                  )}
                </label>
              </div>
            </SectionCard>

            {/* Category */}
            <SectionCard
              title="Product Category"
              description="Choose the primary Zelvomart category for this item."
            >
              <label className="field">
                <span>Category</span>
                <select
                  name="categoryId"
                  defaultValue={initial?.categoryId || initial?.category?.id || ""}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </SectionCard>

            {/* Short Description */}
            <SectionCard
              title="Short Description"
              description="Keep this concise. It appears near the product price and buying actions."
            >
              <label className="field">
                <textarea
                  name="shortDescription"
                  rows={4}
                  defaultValue={initial?.shortDescription || ""}
                  placeholder="Key benefit, use case and important product detail..."
                />
              </label>
            </SectionCard>

            {/* Main Description */}
            <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
              <h2 className="text-[13px] font-bold uppercase text-navy tracking-normal">
                Main Description
              </h2>
              <p className="mt-1 text-[11px] text-slate tracking-normal">
                Format the product description with paragraphs, headings, alignment, emphasis, lists and internal links.
              </p>
              <div className="mt-4 space-y-4">
                <AdminRichTextEditor
                  name="descriptionHtml"
                  defaultValue={initial?.descriptionHtml || initial?.description || ""}
                />
              </div>
            </section>

            {/* Pricing & Stock */}
            <SectionCard
              title="Pricing & Stock"
              description="Set selling price, optional sale/cost price and available stock."
            >
              <div className="admin-reference-form admin-ls-pricing-grid">
                <label className="field">
                  <span>Regular Price (PKR) <em>*</em></span>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={initial?.regularPrice ?? initial?.price ?? ""}
                    required
                  />
                </label>
                <label className="field">
                  <span>Sale Price (PKR)</span>
                  <input
                    name="salePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={initial?.salePrice ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Cost Price (PKR)</span>
                  <input
                    name="costPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={initial?.costPrice ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Stock <em>*</em></span>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    defaultValue={initial?.stock ?? initial?.stockQuantity ?? 100}
                    required
                  />
                </label>
              </div>
            </SectionCard>

            {/* Storefront Options */}
            <SectionCard
              title="Storefront Options"
              description="Control featured placement and the optional buy-2 offer."
            >
              <div className="admin-reference-form admin-ls-form-grid">
                <label className="admin-check">
                  <input
                    type="checkbox"
                    name="featured"
                    defaultChecked={Boolean(initial?.featured)}
                  />{" "}
                  Featured product
                </label>
                <label className="admin-check">
                  <input
                    type="checkbox"
                    name="bundleEnabled"
                    defaultChecked={initial?.bundleEnabled !== false}
                  />{" "}
                  Enable buy-2 bundle
                </label>
                <label className="field">
                  <span>Bundle discount %</span>
                  <input
                    name="bundleDiscountPercent"
                    type="number"
                    min="0"
                    max="99"
                    step="0.01"
                    defaultValue={initial?.bundleDiscountPercent ?? 5}
                  />
                </label>
              </div>
            </SectionCard>

            {/* Images & Media */}
            <SectionCard
              title="Images & Media"
              description="Add up to 10 product images. Stored on Cloudflare R2 with zero egress fees."
            >
              <div className="admin-form-section-head-row admin-media-actions">
                <div />
                <button
                  type="button"
                  className="admin-btn admin-btn-light"
                  disabled={uploadBusy || images.length >= 10}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploadBusy ? "Uploading to R2..." : "Upload Images"}
                </button>
              </div>
              <input
                ref={fileRef}
                hidden
                type="file"
                accept="image/*"
                multiple
                onChange={uploadImages}
              />

              <div className="admin-product-image-grid">
                {images.map((src, index) => (
                  <div className="admin-product-image-card" key={`${src}-${index}`}>
                    <div className="admin-product-image-preview">
                      <img src={src} alt="" />
                    </div>
                    <div className="admin-product-image-card-copy">
                      <b>{index === 0 ? "Main image" : `Gallery image ${index + 1}`}</b>
                      <small title={src}>{src}</small>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() =>
                        setImages((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {!images.length ? (
                  <div className="admin-product-image-empty">
                    No images yet. Upload product images or add an image URL below.
                  </div>
                ) : null}
              </div>

              <div className="admin-manual-image-row" style={{ marginTop: "1rem" }}>
                <input
                  value={manualImage}
                  onChange={(event) => setManualImage(event.target.value)}
                  placeholder="Or paste an image URL..."
                />
                <button
                  type="button"
                  className="admin-btn admin-btn-light"
                  onClick={addManualImage}
                  disabled={!manualImage.trim() || images.length >= 10}
                >
                  Add URL
                </button>
              </div>

              <label className="field" style={{ marginTop: "1rem" }}>
                <span>Product Video URL</span>
                <input
                  name="videoUrl"
                  defaultValue={initial?.videoUrl || ""}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
            </SectionCard>

            {/* --- COLOR VARIANTS SECTION --- */}
            <SectionCard
              title="Color Variants"
              description="Add color options (e.g. Light Blue, Pink, Purple, White, Black) with individual photos."
            >
              <div
                style={{
                  marginBottom: "0.85rem",
                  padding: "6px 12px",
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#92400e",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⚠</span>
                <span>Variants are not saved yet.</span>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1rem",
                }}
              >
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {variants.length} color{variants.length === 1 ? "" : "s"} configured
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={openAddVariantModal}
                >
                  + Add Color Variant
                </button>
              </div>

              {variants.length === 0 ? (
                <div
                  style={{
                    padding: "2rem",
                    textAlign: "center",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "8px",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  No color variants added yet. Click <b>+ Add Color Variant</b> to add colors like Pink, Light Blue, White.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
                  {variants.map((v, index) => (
                    <div
                      key={v.id || index}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.85rem 1rem",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {/* Circular Swatch */}
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            border: "2px solid #0284c7",
                            overflow: "hidden",
                            backgroundColor: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 0 0 2px rgba(2, 132, 199, 0.15)",
                            flexShrink: 0,
                          }}
                        >
                          {v.imageUrl ? (
                            <img
                              src={v.imageUrl}
                              alt={v.name}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: "bold", color: "#64748b" }}>
                              {v.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div>
                          <strong style={{ fontSize: "14px", color: "#0f172a", textTransform: "capitalize" }}>
                            {v.name}
                          </strong>
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            Stock: {v.stock}
                            {v.priceOverride ? ` · Rs ${v.priceOverride}` : ""}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-light"
                          style={{ padding: "4px 8px", fontSize: "12px" }}
                          onClick={() => openEditVariantModal(index)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="admin-btn"
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            background: "#fee2e2",
                            color: "#ef4444",
                            border: "none",
                          }}
                          onClick={() => handleDeleteVariant(index)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Sidebar */}
          <aside className="admin-product-sidebar admin-product-sidebar-reference">
            <section className="admin-form-section admin-ls-section admin-seo-card admin-seo-panel admin-sticky-section">
              <div className="admin-seo-panel-head">
                <h3>SEO Panel</h3>
                <span>{seoChecks.passed}/{seoChecks.total} checks</span>
              </div>

              <div className="admin-seo-score-row">
                <div
                  className="admin-seo-score-ring"
                  style={{
                    background: `conic-gradient(#0aa7d8 ${seoChecks.score * 3.6}deg, #e5eaee 0deg)`,
                  }}
                >
                  <div>{seoChecks.score}</div>
                </div>
                <div className="admin-seo-score-copy">
                  <strong>{seoStatus}</strong>
                  <span>SEO score / 100</span>
                </div>
              </div>

              <label className="field admin-seo-field">
                <span>Focus Keyword <small>{focusKeyword.length}/100</small></span>
                <input
                  value={focusKeyword}
                  maxLength={100}
                  onChange={(event) => setFocusKeyword(event.target.value)}
                  placeholder="e.g. matte liquid lipgloss"
                />
              </label>

              <label className="field admin-seo-field">
                <span>SEO Title <small className={seoTitle.length > 60 ? "over" : ""}>{seoTitle.length}/60</small></span>
                <input
                  name="seoTitle"
                  value={seoTitle}
                  maxLength={70}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  placeholder="Meta title shown in search results"
                />
              </label>

              <label className="field admin-seo-field">
                <span>Meta Description <small className={seoDescription.length > 160 ? "over" : ""}>{seoDescription.length}/160</small></span>
                <textarea
                  name="seoDescription"
                  rows={4}
                  value={seoDescription}
                  maxLength={180}
                  onChange={(event) => setSeoDescription(event.target.value)}
                  placeholder="Meta description shown in search results"
                />
              </label>

              <div className="admin-search-preview">
                <span>Search Preview</span>
                <div className="admin-search-preview-card">
                  <small>https://zelvomart.com/product/{slug || "product-slug"}</small>
                  <strong>{seoPreviewTitle}</strong>
                  <p>{seoPreviewDescription}</p>
                </div>
              </div>

              <details className="admin-seo-advanced">
                <summary>Advanced SEO</summary>
                <label className="field">
                  <span>Canonical URL</span>
                  <input
                    name="canonicalUrl"
                    defaultValue={initial?.canonicalUrl || ""}
                    placeholder="https://zelvomart.com/product/..."
                  />
                </label>
              </details>
            </section>

            <section className="admin-form-section admin-ls-section admin-product-status-card">
              <div className="admin-form-section-head">
                <h3>Status</h3>
              </div>
              <label className="field">
                <span>Product Status</span>
                <select
                  name="status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <p className="admin-status-note">
                {initial ? "Editing existing product" : "New product draft"} ·{" "}
                <b>{status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</b>
              </p>
            </section>
          </aside>
        </div>

        {error ? (
          <div className="admin-import-message error admin-product-form-message">
            {error.replace(/_/g, " ")}
          </div>
        ) : null}
        {savedMessage ? (
          <div className="admin-import-message success admin-product-form-message">
            {savedMessage}
          </div>
        ) : null}

        <div className="admin-product-footer-actions">
          <button
            type="button"
            className="admin-btn admin-btn-light"
            onClick={() => window.history.back()}
          >
            Cancel
          </button>
          <div>
            <button
              type="button"
              className="admin-btn admin-btn-light admin-save-draft-btn"
              disabled={busy}
              onClick={() => saveForm("DRAFT")}
            >
              {busy ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={busy}
              onClick={() => saveForm("PUBLISHED")}
            >
              {busy ? "Saving..." : "Publish"}
            </button>
          </div>
        </div>
      </form>

      {/* --- ADD / EDIT COLOR VARIANT MODAL --- */}
      {isVariantModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "1rem",
          }}
          onClick={() => setIsVariantModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              maxWidth: "500px",
              width: "100%",
              padding: "1.75rem",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.25rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                {editingVariantIndex !== null ? "Edit Color Variant" : "Add Color Variant"}
              </h3>
              <button
                type="button"
                onClick={() => setIsVariantModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.25rem",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Row 1: Name and SKU */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    Color Name *
                  </label>
                  <input
                    type="text"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    placeholder="e.g. Pink, Light Blue, White"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      marginTop: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    SKU (Auto-generated)
                  </label>
                  <input
                    type="text"
                    value={variantSku}
                    onChange={(e) => setVariantSku(e.target.value)}
                    placeholder="Auto SKU"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      marginTop: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              {/* Row 2: Stock and Price Override */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    Stock Available *
                  </label>
                  <input
                    type="number"
                    value={variantStock}
                    onChange={(e) => setVariantStock(Number(e.target.value))}
                    min="0"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      marginTop: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                    Price Override (Optional)
                  </label>
                  <input
                    type="number"
                    value={variantPriceOverride}
                    onChange={(e) => setVariantPriceOverride(e.target.value)}
                    placeholder="Leave empty for base price"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      marginTop: "4px",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              {/* Row 3: Color Swatch Image */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  Color Swatch Photo
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    marginTop: "6px",
                  }}
                >
                  {/* Swatch Circle Preview */}
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      border: "2px solid #0284c7",
                      boxShadow: "0 0 0 2px rgba(2, 132, 199, 0.2)",
                      overflow: "hidden",
                      backgroundColor: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {variantImageUrl ? (
                      <img
                        src={variantImageUrl}
                        alt="Preview"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>No img</span>
                    )}
                  </div>

                  <div style={{ flex: 1, display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      value={variantImageUrl}
                      onChange={(e) => setVariantImageUrl(e.target.value)}
                      placeholder="https://pub-...r2.dev/..."
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                      }}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-light"
                      style={{ fontSize: "12px", padding: "8px 12px", whiteSpace: "nowrap" }}
                      disabled={variantUploadBusy}
                      onClick={() => variantFileRef.current?.click()}
                    >
                      {variantUploadBusy ? "Uploading..." : "Upload to R2"}
                    </button>
                    <input
                      ref={variantFileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={uploadVariantImage}
                    />
                  </div>
                </div>

                {/* Quick select from product gallery */}
                {images.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Or click an uploaded product photo to assign:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginTop: "4px",
                        overflowX: "auto",
                        paddingBottom: "4px",
                      }}
                    >
                      {images.map((src, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectGalleryImageForVariant(src)}
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "6px",
                            border:
                              variantImageUrl === src
                                ? "2px solid #0284c7"
                                : "1px solid #cbd5e1",
                            padding: 0,
                            overflow: "hidden",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={src}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn-light"
                  onClick={() => setIsVariantModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleSaveVariant}
                >
                  {editingVariantIndex !== null ? "Update Color" : "Save Color"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}