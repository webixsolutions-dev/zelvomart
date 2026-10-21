"use client";
import { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  ShieldCheck,
  FlaskConical,
  Trash2,
  Save,
  Send,
  UserRound,
  Info,
} from "lucide-react";
import { clientApi } from "@/lib/client-api";
import { reviewFormPayload } from "@/lib/review-upload";
import { Button, Select, Modal, Rating, Badge } from "./controls";
import { today, type Product, type Review, type Media } from "./types";

type LocalMedia = { file: File; url: string; type: "image" | "video" };
export default function ReviewEditor({
  review,
  demo = false,
  products,
  onClose,
  onSaved,
}: {
  review?: Review;
  demo?: boolean;
  products: Product[];
  onClose: () => void;
  onSaved: (review: Review) => Promise<void>;
}) {
  const [productId, setProductId] = useState(review?.productId || ""),
    [name, setName] = useState(review?.name || (demo ? "Demo reviewer" : "")),
    [email, setEmail] = useState(
      review?.email || (demo ? "demo@example.invalid" : ""),
    ),
    [rating, setRating] = useState(review?.rating || 5),
    [body, setBody] = useState(
      review?.body ||
        (demo
          ? "Demo review for testing the admin workflow. This is sample content, not customer feedback."
          : ""),
    ),
    [date, setDate] = useState(
      (review?.reviewDate || review?.createdAt || today()).slice(0, 10),
    ),
    [status, setStatus] = useState(review?.status || "PENDING"),
    [isTest, setTest] = useState(review ? review.origin === "TEST" : demo);
  const [files, setFiles] = useState<LocalMedia[]>([]),
    [retained, setRetained] = useState<Media[]>(review?.media || []),
    [avatar, setAvatar] = useState<LocalMedia>(),
    [removeAvatar, setRemoveAvatar] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const urls = useRef(new Set<string>()),
    locked = useRef(false),
    fileInput = useRef<HTMLInputElement>(null),
    avatarInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const product = products.find((p) => p.id === productId);
  function local(file: File, type: "image" | "video") {
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    return { file, url, type };
  }
  function removeLocal(item: LocalMedia) {
    URL.revokeObjectURL(item.url);
    urls.current.delete(item.url);
  }
  function addFiles(input: FileList | null) {
    if (!input) return;
    setError("");
    const next = [...files];
    for (const file of Array.from(input)) {
      const type =
        file.type === "video/mp4"
          ? "video"
          : ["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ? "image"
            : null;
      if (!type) {
        setError("Use JPEG, PNG, WebP photos or an MP4 video.");
        continue;
      }
      if (file.size > (type === "video" ? 20 : 5) * 1024 * 1024) {
        setError(
          `${type === "video" ? "Video" : "Photo"} exceeds the ${type === "video" ? 20 : 5} MB limit.`,
        );
        continue;
      }
      if (
        [...retained, ...next].filter((m) => m.type === type).length >=
        (type === "video" ? 1 : 5)
      ) {
        setError(
          "Each review supports up to 5 photos and 1 video, including existing files.",
        );
        continue;
      }
      next.push(local(file, type));
    }
    setFiles(next);
  }
  function addAvatar(file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Avatar must be JPEG, PNG or WebP, up to 5 MB.");
      return;
    }
    if (avatar) removeLocal(avatar);
    setAvatar(local(file, "image"));
    setRemoveAvatar(false);
    setError("");
  }
  function fillDemo() {
    setTest(true);
    setName("Demo reviewer");
    setEmail("demo@example.invalid");
    setRating(5);
    setBody(
      "Demo review for testing the admin workflow. This is sample content, not customer feedback.",
    );
    setDate(today());
    setFieldErrors({});
    setError("");
  }
  async function submit() {
    if (locked.current) return;
    const invalid: Record<string, string> = {};
    if (!product) invalid.productId = "Select an existing product.";
    if (!name.trim()) invalid.name = "Enter a display name.";
    if (
      (!email.trim() && !isTest && !review) ||
      (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()))
    )
      invalid.email = "Enter a valid private email.";
    if (!body.trim()) invalid.body = "Write a review before saving.";
    const parsedDate = new Date(date + "T00:00:00Z");
    if (
      !date ||
      date > today() ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    )
      invalid.date = "Choose a valid date, today or earlier.";
    setFieldErrors(invalid);
    if (Object.keys(invalid).length) {
      setError(
        "Check the highlighted fields. Your changes have not been saved.",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      Object.entries({
        productId,
        name: name.trim(),
        email: email.trim(),
        rating: String(rating),
        body: body.trim(),
        reviewDate: date,
        status,
        isTest: String(isTest),
      }).forEach(([k, v]) => form.append(k, v));
      files.forEach((m) => form.append("media", m.file));
      if (avatar) form.append("avatar", avatar.file);
      if (review) {
        form.append(
          "retainMediaIds",
          JSON.stringify(retained.map((m) => m.id)),
        );
        form.append("removeAvatar", String(removeAvatar));
      }
      const payload = await reviewFormPayload(form);
      const saved = await clientApi<Review>(
        review ? `/api/admin/reviews/${review.id}` : "/api/admin/reviews",
        { method: review ? "PATCH" : "POST", body: JSON.stringify(payload) },
        true,
      );
      await onSaved({ ...saved, product: product! });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save review. Please retry.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const avatarUrl =
    avatar?.url || (!removeAvatar ? review?.avatarUrl : undefined);
  return (
    <Modal
      title={review ? "Edit review" : "Add review"}
      description={
        review
          ? "Update the review, attachments and moderation status."
          : "Choose a product and add a genuine review, or try the workflow in demo mode."
      }
      onClose={onClose}
      busy={busy}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="rw-editor"
        noValidate
      >
        <div className="rw-editor-body">
          <fieldset disabled={busy}>
            <div className="rw-editor-layout">
              <div className="rw-editor-main">
                {!review && (
                  <div className="rw-mode">
                    <button
                      type="button"
                      aria-pressed={!isTest}
                      onClick={() => setTest(false)}
                    >
                      <ShieldCheck size={16} />
                      Genuine review
                    </button>
                    <button
                      type="button"
                      aria-pressed={isTest}
                      onClick={() => setTest(true)}
                    >
                      <FlaskConical size={16} />
                      Demo review
                    </button>
                  </div>
                )}
                {isTest && (
                  <div className="rw-callout rw-callout-demo">
                    <FlaskConical size={18} />
                    <div>
                      <strong>Demo review · admin only</strong>
                      <p>
                        Try approval and editing freely. This review stays off
                        public pages and does not change product ratings.
                      </p>
                    </div>
                  </div>
                )}
                <div className="rw-field">
                  <span id="rw-product-label">
                    Product <em>*</em>
                  </span>
                  <Select
                    label="Product"
                    value={productId}
                    onChange={(value) => {
                      setProductId(value);
                      setFieldErrors({ ...fieldErrors, productId: "" });
                    }}
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.title,
                      detail: p.sku,
                    }))}
                    placeholder="Search and select a product"
                    searchable
                    disabled={!!review && review.origin === "CUSTOMER"}
                  />
                  {fieldErrors.productId && (
                    <small className="rw-field-error">
                      {fieldErrors.productId}
                    </small>
                  )}
                  {review?.origin === "CUSTOMER" && (
                    <small>
                      Purchase verification keeps this review linked to its
                      original product.
                    </small>
                  )}
                </div>
                <div className="rw-form-grid">
                  <label className="rw-field">
                    Reviewer name <em>*</em>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={200}
                      autoComplete="off"
                      placeholder="Name displayed with the review"
                      aria-invalid={!!fieldErrors.name}
                    />
                    {fieldErrors.name && (
                      <small className="rw-field-error">
                        {fieldErrors.name}
                      </small>
                    )}
                  </label>
                  <label className="rw-field">
                    Private email {!isTest && !review && <em>*</em>}
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      maxLength={254}
                      placeholder={
                        isTest
                          ? "Optional in demo mode"
                          : "customer@example.com"
                      }
                      aria-invalid={!!fieldErrors.email}
                    />
                    <small>
                      {fieldErrors.email || "Visible to admins only."}
                    </small>
                  </label>
                </div>
                <div className="rw-rating-field">
                  <span>
                    Rating <em>*</em>
                  </span>
                  <div>
                    <Rating value={rating} onChange={setRating} />
                    <strong>
                      {rating}.0 <small>/ 5</small>
                    </strong>
                  </div>
                </div>
                <label className="rw-field">
                  Review text <em>*</em>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={5}
                    maxLength={20000}
                    placeholder="Enter the full review…"
                    aria-invalid={!!fieldErrors.body}
                  />
                  <small className={fieldErrors.body ? "rw-field-error" : ""}>
                    {fieldErrors.body ||
                      `${body.length.toLocaleString()} / 20,000 characters`}
                  </small>
                </label>
                <div className="rw-upload-heading">
                  <div>
                    <h3>Photos & video</h3>
                    <p>
                      5 photos · JPEG, PNG, WebP, 5 MB each. 1 MP4 · up to 20
                      MB.
                    </p>
                  </div>
                  <span>{retained.length + files.length} / 6</span>
                </div>
                <input
                  ref={fileInput}
                  className="rw-hidden-file"
                  type="file"
                  aria-label="Add review media"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="rw-dropzone"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }}
                >
                  <span className="rw-upload-icon">
                    <ImagePlus size={21} />
                  </span>
                  <span>
                    <strong>Click to upload or drag files here</strong>
                    <small>Attachments stay with this review.</small>
                  </span>
                </button>
                {!!(retained.length + files.length) && (
                  <div className="rw-editor-media">
                    {retained.map((m, i) => (
                      <div key={m.id || m.url || i}>
                        {m.type === "video" ? (
                          <video controls preload="metadata" src={m.url} />
                        ) : (
                          <img src={m.url} alt="Existing review photo" />
                        )}
                        <button
                          type="button"
                          aria-label={`Remove existing attachment ${i + 1}`}
                          onClick={() =>
                            setRetained((all) =>
                              all.filter((_, index) => index !== i),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                        <small>Saved</small>
                      </div>
                    ))}
                    {files.map((m, i) => (
                      <div key={m.url}>
                        {m.type === "video" ? (
                          <video src={m.url} controls />
                        ) : (
                          <img src={m.url} alt={`New attachment ${i + 1}`} />
                        )}
                        <button
                          type="button"
                          aria-label={`Remove new attachment ${i + 1}`}
                          onClick={() => {
                            removeLocal(m);
                            setFiles((all) => all.filter((f) => f !== m));
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                        <small>New</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <aside className="rw-editor-aside">
                <section className="rw-aside-card">
                  <h3>Moderation</h3>
                  <div className="rw-field">
                    <span>Review status</span>
                    <Select
                      label="Review status"
                      value={status}
                      onChange={setStatus}
                      options={[
                        {
                          value: "PENDING",
                          label: "Pending",
                          detail: "Awaiting a moderation decision",
                        },
                        {
                          value: "APPROVED",
                          label: isTest ? "Approved · demo only" : "Approved",
                          detail: isTest
                            ? "Visible in the admin only"
                            : "Visible on the product page",
                        },
                        {
                          value: "REJECTED",
                          label: "Rejected",
                          detail: "Hidden from public pages",
                        },
                      ].filter((o) => review || o.value !== "REJECTED")}
                    />
                  </div>
                  <label className="rw-field">
                    Original review date <em>*</em>
                    <input
                      type="date"
                      value={date}
                      max={today()}
                      onChange={(e) => setDate(e.target.value)}
                      aria-invalid={!!fieldErrors.date}
                    />
                    {fieldErrors.date && (
                      <small className="rw-field-error">
                        {fieldErrors.date}
                      </small>
                    )}
                  </label>
                  <div className="rw-aside-note">
                    <Info size={15} />
                    <p>
                      {isTest
                        ? "Demo approval is for testing. It never publishes customer feedback."
                        : "Only approved genuine reviews appear publicly. The original date is preserved."}
                    </p>
                  </div>
                  {review?.reviewRef && (
                    <div className="rw-reference">
                      <span>Reference</span>
                      <code>{review.reviewRef}</code>
                    </div>
                  )}
                </section>
                <section className="rw-aside-card">
                  <h3>Reviewer avatar</h3>
                  <div className="rw-avatar-editor">
                    <span className="rw-avatar rw-avatar-lg">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Reviewer avatar" />
                      ) : (
                        <UserRound size={24} />
                      )}
                    </span>
                    <div>
                      <Button onClick={() => avatarInput.current?.click()}>
                        Choose photo
                      </Button>
                      <small>Authorised photo · up to 5 MB</small>
                    </div>
                  </div>
                  <input
                    ref={avatarInput}
                    className="rw-hidden-file"
                    type="file"
                    aria-label="Choose reviewer avatar"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      addAvatar(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {avatarUrl && (
                    <button
                      type="button"
                      className="rw-text-button rw-text-danger"
                      onClick={() => {
                        if (avatar) removeLocal(avatar);
                        setAvatar(undefined);
                        setRemoveAvatar(true);
                      }}
                    >
                      Remove avatar
                    </button>
                  )}
                </section>
                <div className="rw-mini-preview">
                  <span className="rw-eyebrow">Review preview</span>
                  <div className="rw-preview-reviewer">
                    <span className="rw-avatar">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" />
                      ) : (
                        name.trim().charAt(0).toUpperCase() || "?"
                      )}
                    </span>
                    <div>
                      <strong>{name || "Reviewer name"}</strong>
                      <small>{product?.title || "Select a product"}</small>
                    </div>
                  </div>
                  <Rating value={rating} />
                  <p>{body || "Your review text will appear here."}</p>
                  {isTest && <Badge status="TEST" test />}
                </div>
              </aside>
            </div>
          </fieldset>
        </div>
        {error && (
          <div className="rw-form-alert" role="alert">
            {error}
          </div>
        )}
        <footer className="rw-modal-footer">
          <div>
            {!review && (
              <Button variant="ghost" onClick={fillDemo} disabled={busy}>
                <FlaskConical size={16} />
                Fill demo details
              </Button>
            )}
          </div>
          <div>
            <Button onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy}>
              <Save size={16} />
              {review
                ? "Save changes"
                : status === "APPROVED"
                  ? isTest
                    ? "Save approved demo"
                    : "Save & approve"
                  : "Save review"}
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
