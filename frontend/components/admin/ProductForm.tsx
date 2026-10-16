"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AdminRichTextEditor from "./AdminRichTextEditor";
import { clearAdminDataCache, useAdminData } from "./useAdminData";
import { clientApi, uploadAdminImage } from "@/lib/client-api";
import { badgesFromCatalog } from "@/lib/product-badges";
import { PRODUCT_TAB_DEFS, mergeGlobalProductTabs, readProductTabOverrides, type ProductTabKey, type ProductTabOverride } from "@/lib/product-tabs";
import type { Product } from "@/types/product";
import { resolveDeliveryPolicy, type DeliveryPolicy } from "@/lib/shipping";
import { buildProductSchema } from "@/lib/product-schema";
import { parseVideoUrl, VIDEO_URL_ERROR } from "@/lib/product-video";
import { toast } from "react-toastify";

type Category = { id: string; name: string; slug?: string };
type ProductType = "simple" | "variable";
type StockStatus = "instock" | "outofstock";
type DataTab =
  | "general"
  | "inventory"
  | "shipping"
  | "attributes"
  | "variations"
  | "tabs"
  | "swatches"
  | "delivery";
type SeoTab = "general" | "advanced" | "schema";
type SeoGroupKey = "basic" | "additional" | "title" | "content";
type ImageMeta = {
  alt: string;
  title: string;
  fileName: string;
  fileSize: number;
  width: number;
  height: number;
};

const PRODUCT_TAGS: { id: string; label: string; hint: string }[] = [
  { id: "customer-favourite", label: "Customer favourite", hint: "Centre badge" },
  { id: "best-selling", label: "Best selling", hint: "Bestsellers" },
  { id: "new-arrival", label: "New arrival", hint: "New in" },
  { id: "15-off", label: "15% off", hint: "Discounts" },
  { id: "20-off", label: "20% off", hint: "Discounts" },
  { id: "30-off", label: "30% off", hint: "Discounts" },
];

const EMPTY_IMAGE_META: ImageMeta = {
  alt: "",
  title: "",
  fileName: "",
  fileSize: 0,
  width: 0,
  height: 0,
};

type AttributeItem = {
  id: string;
  name: string;
  valuesText: string;
  visible: boolean;
  forVariations: boolean;
  open: boolean;
};

type VariationItem = {
  key: string;
  name: string;
  attributes: Record<string, string>;
  sku: string;
  gtin: string;
  regularPrice: string;
  salePrice: string;
  saleFrom: string;
  saleTo: string;
  scheduleOpen: boolean;
  /** "Manage stock?": ON = quantity is live and goes down with each order. */
  trackStock: boolean;
  quantity: number;
  /** Used when Manage stock is OFF. */
  stockStatus: StockStatus;
  weight: string;
  length: string;
  width: string;
  height: string;
  images: string[];
  enabled: boolean;
  open: boolean;
  /** SKU and quantity of the saved variation, so a save only writes a quantity the admin changed. */
  liveSku: string;
  liveQuantity: number | null;
};

type CustomTab = { id: string; title: string; content: string };

type ProductFormProps = {
  categories: Category[];
  initial?: any;
  onSaved?: (product?: any) => void;
};

const SIMPLE_TABS: { id: DataTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "inventory", label: "Inventory" },
  { id: "shipping", label: "Shipping" },
  { id: "attributes", label: "Attributes" },
  { id: "tabs", label: "Product Tabs" },
];

const VARIABLE_TABS: { id: DataTab; label: string }[] = [
  { id: "inventory", label: "Inventory" },
  { id: "shipping", label: "Shipping" },
  { id: "attributes", label: "Attributes" },
  { id: "variations", label: "Variations" },
  { id: "tabs", label: "Product Tabs" },
];

/** Only In stock and Out of stock exist; an old "onbackorder" value reads as Out of stock. */
function readStockStatus(value: unknown, fallback: StockStatus): StockStatus {
  if (value === "instock") return "instock";
  if (value === "outofstock" || value === "onbackorder") return "outofstock";
  return fallback;
}

const POWER_WORDS = ["best", "exclusive", "proven", "limited", "free", "new", "premium", "ultimate", "guaranteed", "official"];
const SENTIMENT_WORDS = ["amazing", "beautiful", "perfect", "easy", "elegant", "fresh", "soft", "stunning", "reliable", "powerful", "love"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function plainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(html: string) {
  const text = plainText(html);
  return text ? text.split(/\s+/).length : 0;
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Shop availability with the shared rule: Track ON -> quantity above 0, Track OFF -> the chosen status. */
function availability(track: boolean, quantity: number, status: StockStatus): StockStatus {
  if (track) return quantity > 0 ? "instock" : "outofstock";
  return status;
}

function wholeQuantity(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function parseValues(value: string) {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function emptyVariation(attributes: Record<string, string> = {}, open = false): VariationItem {
  return {
    key: uid("var"),
    name: Object.values(attributes).filter(Boolean).join(" / ") || "New variation",
    attributes,
    sku: "",
    gtin: "",
    regularPrice: "",
    salePrice: "",
    saleFrom: "",
    saleTo: "",
    scheduleOpen: false,
    trackStock: false,
    quantity: 0,
    stockStatus: "instock",
    weight: "",
    length: "",
    width: "",
    height: "",
    images: [],
    enabled: true,
    open,
    liveSku: "",
    liveQuantity: null,
  };
}

function variationKey(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}:${value}`)
    .join("|");
}

function buildVariations(attributes: AttributeItem[], current: VariationItem[]) {
  const usable = attributes.filter((attribute) => attribute.forVariations && attribute.name.trim() && parseValues(attribute.valuesText).length);
  if (!usable.length) return current;
  let rows: Record<string, string>[] = [{}];
  usable.forEach((attribute) => {
    const values = parseValues(attribute.valuesText);
    rows = rows.flatMap((row) => values.map((value) => ({ ...row, [attribute.name.trim()]: value })));
  });
  const built = rows
    .filter((row) => Object.keys(row).length)
    .map((attributesMap, index) => {
      const key = variationKey(attributesMap);
      const existing = current.find((item) => item.key === key);
      const name = Object.values(attributesMap).join(" / ");
      if (existing) return { ...existing, name, attributes: attributesMap };
      return {
        ...emptyVariation(attributesMap, index === 0),
        key,
        name,
      } satisfies VariationItem;
    });
  const firstOpen = built.findIndex((item) => item.open);
  return built.map((item, index) => (item.open && index !== firstOpen ? { ...item, open: false } : item));
}

function TabIcon({ id }: { id: DataTab }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, "aria-hidden": true };
  if (id === "general") {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    );
  }
  if (id === "inventory") {
    return (
      <svg {...common}>
        <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
      </svg>
    );
  }
  if (id === "shipping") {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="18" r="1.6" />
        <circle cx="18" cy="18" r="1.6" />
      </svg>
    );
  }
  if (id === "attributes" || id === "variations") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.4" />
        <rect x="14" y="3" width="7" height="7" rx="1.4" />
        <rect x="3" y="14" width="7" height="7" rx="1.4" />
        <rect x="14" y="14" width="7" height="7" rx="1.4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export default function ProductForm({ categories, initial, onSaved }: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const mainImageRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const variationImageRef = useRef<HTMLInputElement>(null);
  const catalog = initial?.catalogMeta || {};
  const initialImages = (
    initial?.rawImages ||
    initial?.images?.map((image: any) => (typeof image === "string" ? image : image?.src)) ||
    []
  ).filter(Boolean) as string[];

  const [categoryOptions, setCategoryOptions] = useState<Category[]>(categories);
  const [productType, setProductType] = useState<ProductType>(catalog.productType || (initial?.variants?.length ? "variable" : "simple"));
  const [activeTab, setActiveTab] = useState<DataTab>(catalog.productType === "variable" ? "inventory" : "general");
  const [title, setTitle] = useState(initial?.title || initial?.name || "");
  const [slug, setSlug] = useState(initial?.slug || "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [editingSlug, setEditingSlug] = useState(false);
  const [status, setStatus] = useState(initial?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
  const [sku, setSku] = useState(initial?.sku || "");
  const [skuTouched, setSkuTouched] = useState(Boolean(initial?.sku));
  const [regularPrice, setRegularPrice] = useState(String(initial?.regularPrice ?? initial?.price ?? ""));
  const [salePrice, setSalePrice] = useState(initial?.salePrice != null ? String(initial.salePrice) : "");
  const [scheduleOpen, setScheduleOpen] = useState(Boolean(catalog.saleFrom || catalog.saleTo));
  const [saleFrom, setSaleFrom] = useState(catalog.saleFrom || "");
  const [saleTo, setSaleTo] = useState(catalog.saleTo || "");
  // New products: Track stock OFF + In stock. Saved products read the live columns.
  const [trackStock, setTrackStock] = useState<boolean>(Boolean(initial?.trackStock));
  const [quantity, setQuantity] = useState<number>(wholeQuantity(initial?.stock));
  // The live quantity when the form loaded or last saved: a save only sends `stock` when it changed.
  const [savedQuantity, setSavedQuantity] = useState<number | null>(initial ? wholeQuantity(initial.stock) : null);
  const [stockStatus, setStockStatus] = useState<StockStatus>(readStockStatus(initial?.stockSetting, "instock"));
  const [weight, setWeight] = useState(catalog.weight && catalog.weight !== "0" ? catalog.weight : "");
  const [length, setLength] = useState(catalog.length || "");
  const [width, setWidth] = useState(catalog.width || "");
  const [height, setHeight] = useState(catalog.height || "");
  // Shipping tab: "Delivery charges" (default) or "Free shipping". Never free by default.
  const [freeShipping, setFreeShipping] = useState<boolean>(Boolean(catalog.freeShipping));
  const [attributes, setAttributes] = useState<AttributeItem[]>(
    (catalog.attributes || []).map((item: AttributeItem) => ({
      ...item,
      visible: item.visible !== false,
      forVariations: item.forVariations !== false,
      open: false,
    })),
  );
  const [variations, setVariations] = useState<VariationItem[]>(
    (catalog.variations || []).map((item: any) => {
      // Stock settings and quantity come from the live variation row (matched by SKU).
      const live = (initial?.variants || []).find((variant: any) => item.sku && variant.sku === item.sku);
      return {
      ...emptyVariation(item.attributes || {}),
      key: item.key || variationKey(item.attributes || {}),
      name: item.name || Object.values(item.attributes || {}).join(" / "),
      sku: item.sku || "",
      gtin: item.gtin || "",
      regularPrice: item.regularPrice != null ? String(item.regularPrice) : "",
      salePrice: item.salePrice != null ? String(item.salePrice) : "",
      saleFrom: item.saleFrom || "",
      saleTo: item.saleTo || "",
      scheduleOpen: Boolean(item.saleFrom || item.saleTo),
      trackStock: Boolean(live?.trackStock),
      quantity: wholeQuantity(live?.stock),
      stockStatus: readStockStatus(live?.stockSetting, "instock"),
      weight: item.weight || "",
      length: item.length || "",
      width: item.width || "",
      height: item.height || "",
      images: Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [],
      enabled: item.enabled !== false,
      open: false,
      liveSku: live ? String(live.sku) : "",
      liveQuantity: live ? wholeQuantity(live.stock) : null,
    };
    }),
  );
  const [variationImageKey, setVariationImageKey] = useState<string | null>(null);
  const [swatchShape, setSwatchShape] = useState(catalog.swatchShape || "circle");
  const [swatchSize, setSwatchSize] = useState(catalog.swatchSize || "medium");
  const [swatchesEnabled, setSwatchesEnabled] = useState(catalog.swatchesEnabled !== false);
  const [bundleEnabled, setBundleEnabled] = useState(Boolean(initial?.bundleEnabled ?? catalog.bundleEnabled ?? true));
  const [deliveryDays, setDeliveryDays] = useState(catalog.deliveryDays || "3");
  const [deliveryNote, setDeliveryNote] = useState(catalog.deliveryNote || "Delivered across Pakistan");
  const [customTabs, setCustomTabs] = useState<CustomTab[]>(catalog.customTabs || []);
  const [productTabs, setProductTabs] = useState<Record<ProductTabKey, ProductTabOverride>>(() => readProductTabOverrides(catalog));
  const { data: globalTabData } = useAdminData<{ tabs: Record<string, { title: string; content: string }> | null }>("/api/admin/product-tabs", { tabs: null });
  const globalTabs = useMemo(() => mergeGlobalProductTabs(globalTabData.tabs), [globalTabData.tabs]);
  const [categoryId, setCategoryId] = useState(initial?.categoryId || initial?.category?.id || "");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [mainImage, setMainImage] = useState(initialImages[0] || "");
  const [gallery, setGallery] = useState<string[]>(initialImages.slice(1));
  const [imageMeta, setImageMeta] = useState<ImageMeta>(() => {
    const saved = catalog.imageMeta || {};
    return {
      alt: saved.alt || "",
      title: saved.title || "",
      fileName: saved.fileName || "",
      fileSize: Number(saved.fileSize || 0),
      width: Number(saved.width || 0),
      height: Number(saved.height || 0),
    };
  });
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [catTab, setCatTab] = useState<"all" | "mostUsed">("all");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const [badge, setBadge] = useState(typeof catalog.badge === "string" ? catalog.badge : "");
  const [tags, setTags] = useState<string[]>(Array.isArray(catalog.tags) ? catalog.tags.filter((tag: unknown) => typeof tag === "string") : []);
  const [tagList, setTagList] = useState<{ id: string; label: string; hint: string }[]>(() => {
    const list = [...PRODUCT_TAGS];
    const initialTags = Array.isArray(catalog.tags) ? catalog.tags.filter((tag: unknown) => typeof tag === "string") : [];
    initialTags.forEach((t: string) => {
      if (!list.some((item) => item.id === t)) {
        list.push({ id: t, label: t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), hint: "Custom tag" });
      }
    });
    return list;
  });
  const [newTagInput, setNewTagInput] = useState("");
  const [showAddTag, setShowAddTag] = useState(false);

  function addNewTag() {
    const val = newTagInput.trim();
    if (!val) return;
    const tagId = slugify(val);
    if (!tagList.some((t) => t.id === tagId)) {
      setTagList((prev) => [...prev, { id: tagId, label: val, hint: "Custom tag" }]);
    }
    if (!tags.includes(tagId)) {
      setTags((prev) => [...prev, tagId]);
    }
    setNewTagInput("");
    setShowAddTag(false);
  }
  const [redirectFallback, setRedirectFallback] = useState(catalog.redirectFallback !== false);
  const [redirectUrl, setRedirectUrl] = useState(typeof catalog.redirectUrl === "string" ? catalog.redirectUrl : "");
  // Redirect "Old URL": prefilled with this product's URL; can be any old path (e.g. an old WordPress URL).
  const [redirectFrom, setRedirectFrom] = useState(
    typeof catalog.redirectFrom === "string" && catalog.redirectFrom ? catalog.redirectFrom : initial?.slug ? `/product/${initial.slug}/` : "",
  );
  // Delivery settings for the schema preview (same values the product page uses).
  const [deliveryPolicy, setDeliveryPolicy] = useState<DeliveryPolicy>(() => resolveDeliveryPolicy(null));
  useEffect(() => {
    let cancelled = false;
    clientApi<Record<string, unknown>>("/api/settings/public?keys=store.delivery")
      .then((settings) => {
        if (!cancelled) setDeliveryPolicy(resolveDeliveryPolicy((settings?.["store.delivery"] as any) || null));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  const [uploadBusy, setUploadBusy] = useState<"main" | "gallery" | "variation" | "">("");
  const [descriptionHtml, setDescriptionHtml] = useState(initial?.descriptionHtml || initial?.description || "");
  const [shortHtml, setShortHtml] = useState(initial?.shortDescription || "");
  const [focusKeyword, setFocusKeyword] = useState(catalog.focusKeyword || "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription || "");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl || "");
  // Product video: a YouTube or Vimeo link only (no uploads).
  const [videoInput, setVideoInput] = useState<string>(initial?.videoUrl || "");
  const video = useMemo(() => parseVideoUrl(videoInput), [videoInput]);
  const videoInvalid = Boolean(videoInput.trim()) && !video;
  const [vimeoThumb, setVimeoThumb] = useState<string>(initial?.videoThumbnail || "");
  useEffect(() => {
    // Vimeo has no fixed thumbnail URL: ask its public oEmbed API for the preview.
    if (video?.provider !== "vimeo") return;
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.url)}&width=640`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!cancelled && body?.thumbnail_url) setVimeoThumb(String(body.thumbnail_url));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [video?.provider, video?.url]);
  const videoThumbnail = video ? video.thumbnailUrl || vimeoThumb || "" : "";
  // Click-to-play in the admin preview; reset whenever the link changes.
  const [videoPreviewPlaying, setVideoPreviewPlaying] = useState(false);
  useEffect(() => setVideoPreviewPlaying(false), [video?.url]);
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [seoTab, setSeoTab] = useState<SeoTab>("general");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [inlineSnippetOpen, setInlineSnippetOpen] = useState(false);
  const [robotsIndex, setRobotsIndex] = useState<"index" | "noindex">(catalog.robotsIndex || "index");
  const [robotsNoFollow, setRobotsNoFollow] = useState<boolean>(Boolean(catalog.robotsNoFollow));
  // Accordions: one section open at a time, all closed by default.
  const [openSeoGroup, setOpenSeoGroup] = useState<SeoGroupKey | null>(null);
  const [openProductTab, setOpenProductTab] = useState<ProductTabKey | null>(null);
  const toggleSeoGroup = (key: SeoGroupKey) => setOpenSeoGroup((current) => (current === key ? null : key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  function notifyError(message: string) {
    setError(message);
    toast.error(message);
  }

  function notifySuccess(message: string) {
    setSavedMessage(message);
    toast.success(message);
  }

  useEffect(() => {
    setCategoryOptions(categories);
  }, [categories]);

  const publishedSlugLocked = Boolean(initial && initial.status === "PUBLISHED");
  const tabs = productType === "simple" ? SIMPLE_TABS : VARIABLE_TABS;

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched && !publishedSlugLocked) setSlug(slugify(value));
    if (!skuTouched && !initial) {
      setSku((current: string) => {
        if (current) return current;
        const prefix = value.trim().slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "X") || "PROD";
        return `ZVM-${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      });
    }
  }

  function chooseType(next: ProductType) {
    setProductType(next);
    const nextTabs = next === "simple" ? SIMPLE_TABS : VARIABLE_TABS;
    if (!nextTabs.some((tab) => tab.id === activeTab)) setActiveTab(next === "simple" ? "general" : "inventory");
  }

  function changeQuantity(value: number) {
    setQuantity(wholeQuantity(value));
  }

  function changeStockStatus(nextStatus: StockStatus) {
    setStockStatus(nextStatus);
  }

  /** Opens one variation and closes the others; clicking the open one closes it. */
  function toggleVariation(key: string) {
    setVariations((current) => current.map((item) => ({ ...item, open: item.key === key ? !item.open : false })));
  }

  function updateVariation(key: string, patch: Partial<VariationItem>) {
    setVariations((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function changeVariationQuantity(key: string, value: number) {
    updateVariation(key, { quantity: wholeQuantity(value) });
  }

  function changeVariationStatus(key: string, status: StockStatus) {
    updateVariation(key, { stockStatus: status });
  }

  function updateAttribute(id: string, patch: Partial<AttributeItem>) {
    setAttributes((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeAttribute(id: string) {
    const next = attributes.filter((item) => item.id !== id);
    setAttributes(next);
    setVariations((current) => buildVariations(next, current));
  }

  function saveAttributes() {
    const ready = attributes.filter((item) => item.name.trim() && parseValues(item.valuesText).length);
    if (!ready.length) {
      setError("Add an attribute name and at least one value, separated with |.");
      return;
    }
    const closed = ready.map((item) => ({ ...item, name: item.name.trim(), open: false }));
    setAttributes(closed);
    setError("");
    if (productType === "variable") {
      setVariations((current) => buildVariations(closed, current));
      setActiveTab("variations");
      return;
    }
    notifySuccess("Attributes added. Save the product to show them on the store page.");
  }

  function addManualVariation() {
    const usable = attributes.filter((item) => item.forVariations && item.name.trim() && parseValues(item.valuesText).length);
    if (!usable.length) {
      setError("Add attributes first, then create variations.");
      setActiveTab("attributes");
      return;
    }
    const attributesMap = Object.fromEntries(usable.map((item) => [item.name.trim(), ""]));
    setVariations((current) => [...current.map((item) => ({ ...item, open: false })), emptyVariation(attributesMap, true)]);
  }

  function regenerateVariations() {
    const usable = attributes.filter((item) => item.forVariations && item.name.trim() && parseValues(item.valuesText).length);
    if (!usable.length) {
      setError("Add attributes first, then regenerate variations.");
      setActiveTab("attributes");
      return;
    }
    setVariations((current) => buildVariations(usable, current));
    setError("");
  }

  function setVariationOption(key: string, attributeName: string, value: string) {
    setVariations((current) => {
      const target = current.find((item) => item.key === key);
      if (!target) return current;
      const attributesMap = { ...target.attributes, [attributeName]: value };
      if (Object.values(attributesMap).some((entry) => !entry)) {
        return current.map((item) =>
          item.key === key ? { ...item, attributes: attributesMap, name: Object.values(attributesMap).filter(Boolean).join(" / ") || "New variation" } : item,
        );
      }
      const nextKey = variationKey(attributesMap);
      if (current.some((item) => item.key !== key && item.key === nextKey)) {
        setError("That color and size pair already exists.");
        return current;
      }
      setError("");
      return current.map((item) =>
        item.key === key
          ? { ...item, key: nextKey, attributes: attributesMap, name: Object.values(attributesMap).join(" / ") }
          : item,
      );
    });
  }

  function rememberImageFile(file: File) {
    const preview = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setImageMeta((current) => ({
        ...current,
        fileName: file.name,
        fileSize: file.size,
        width: probe.naturalWidth,
        height: probe.naturalHeight,
        title: current.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
        alt: current.alt || title,
      }));
      URL.revokeObjectURL(preview);
    };
    probe.onerror = () => URL.revokeObjectURL(preview);
    probe.src = preview;
    setImageEditorOpen(true);
  }

  async function uploadFiles(files: File[], target: "main" | "gallery" | "variation", variationKeyOverride?: string) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      setError("Choose an image file.");
      return;
    }
    const previews = images.map((file) => URL.createObjectURL(file));
    const imageKey = variationKeyOverride || variationImageKey;
    const previousMain = mainImage;
    if (target === "main" && previews[0]) setMainImage(previews[0]);
    if (target === "gallery") setGallery((current) => Array.from(new Set([...current, ...previews])).slice(0, 12));
    if (target === "variation" && imageKey) {
      setVariations((current) =>
        current.map((item) =>
          item.key === imageKey ? { ...item, images: Array.from(new Set([...(item.images || []), ...previews])).slice(0, 8) } : item,
        ),
      );
    }
    setUploadBusy(target);
    setError("");
    const uploaded: string[] = [];
    let failure = "";
    for (const file of images) {
      try {
        uploaded.push(await uploadAdminImage(file));
      } catch (requestError) {
        uploaded.push("");
        failure ||= requestError instanceof Error ? requestError.message : `Unable to upload "${file.name}".`;
      }
    }
    // Only Cloudflare URLs stay on the form; previews of failed uploads are removed.
    const swap = (src: string) => {
      const index = previews.indexOf(src);
      return index >= 0 ? uploaded[index] : src;
    };
    // Files are named by their SHA-256, so the same image uploaded again has the same URL:
    // it is skipped instead of being shown twice on the product or the variation.
    const productImages = new Set([mainImage, ...gallery].filter((src) => src && !previews.includes(src)));
    const unique = (list: string[], taken: Set<string>) => {
      const seen = new Set(taken);
      return list.filter((src) => {
        if (!src || seen.has(src)) return false;
        seen.add(src);
        return true;
      });
    };
    const variationBefore = new Set(
      imageKey ? (variations.find((item) => item.key === imageKey)?.images || []).filter((src) => !previews.includes(src)) : [],
    );
    const taken = target === "variation" ? variationBefore : productImages;
    const duplicates = uploaded.filter(Boolean).length - unique(uploaded, taken).length;
    if (target === "main") setMainImage((current) => (current === previews[0] ? uploaded[0] || previousMain : current));
    if (target === "gallery") {
      setGallery((current) => {
        const main = new Set([mainImage].filter(Boolean));
        return unique(current.map(swap).filter(Boolean), main);
      });
    }
    if (target === "variation" && imageKey) {
      setVariations((current) =>
        current.map((item) => (item.key === imageKey ? { ...item, images: unique((item.images || []).map(swap), new Set()) } : item)),
      );
    }
    previews.forEach((url) => URL.revokeObjectURL(url));
    const added = uploaded.filter(Boolean).length - duplicates;
    const skipped = duplicates ? ` ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped.` : "";
    if (failure) {
      notifyError(failure);
    } else if (added > 0) {
      notifySuccess(`${added === 1 ? "Image uploaded successfully." : `${added} images uploaded successfully.`}${skipped}`);
    } else if (duplicates) {
      notifySuccess(`Duplicate skipped: ${duplicates === 1 ? "this image is" : "these images are"} already on the ${target === "variation" ? "variation" : "product"}.`);
    }
    setUploadBusy("");
  }

  async function createCategory() {
    const name = newCategory.trim();
    if (!name || addingCategory) return;
    setAddingCategory(true);
    setError("");
    try {
      const created = await clientApi<Category>(
        "/api/admin/categories",
        { method: "POST", body: JSON.stringify({ name, slug: slugify(name) }) },
        true,
      );
      setCategoryOptions((current) => [...current.filter((item) => item.id !== created.id), created]);
      setCategoryId(created.id);
      setNewCategory("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add the category");
    } finally {
      setAddingCategory(false);
    }
  }

  const seo = useMemo(() => {
    const keyword = focusKeyword.trim().toLowerCase();
    const titleText = (seoTitle || title).trim();
    const descriptionText = seoDescription.trim();
    const body = plainText(`${title} ${shortHtml} ${descriptionHtml}`);
    const bodyLower = body.toLowerCase();
    const words = body ? body.split(/\s+/).length : 0;
    const keywordCount = keyword ? bodyLower.split(keyword).length - 1 : 0;
    const density = words && keyword ? (keywordCount / words) * 100 : 0;
    const html = descriptionHtml;
    const hasSubheading = keyword ? /<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/i.test(html) && plainText(html.match(/<h[2-4][^>]*>[\s\S]*?<\/h[2-4]>/gi)?.join(" ") || "").toLowerCase().includes(keyword) : false;
    const hasExternal = /href\s*=\s*["']https?:\/\//i.test(html);
    const hasInternal = /href\s*=\s*["'](\/|https?:\/\/zelvomart\.com)/i.test(html);
    const hasNofollow = /rel\s*=\s*["'][^"']*nofollow/i.test(html);
    const titleLower = titleText.toLowerCase();
    const slugText = slug.toLowerCase();
    const checks = {
      keywordInTitle: Boolean(keyword && titleLower.includes(keyword)),
      keywordInDescription: Boolean(keyword && descriptionText.toLowerCase().includes(keyword)),
      keywordInUrl: Boolean(keyword && slugText.includes(slugify(keyword))),
      keywordAtStart: Boolean(keyword && bodyLower.slice(0, 80).includes(keyword)),
      keywordInContent: Boolean(keyword && bodyLower.includes(keyword)),
      contentLength: words >= 600 && words <= 2500,
      keywordInSubheading: hasSubheading,
      imageAlt: !mainImage || Boolean(keyword && (imageMeta.alt || title).toLowerCase().includes(keyword)),
      density: density >= 0.5 && density <= 2.5,
      urlLength: slug.length > 0 && slug.length <= 75,
      externalLinks: hasExternal,
      dofollow: hasExternal && !hasNofollow,
      internalLinks: hasInternal,
      hasKeyword: keyword.length >= 2,
      keywordNearTitleStart: Boolean(keyword && titleLower.indexOf(keyword) > -1 && titleLower.indexOf(keyword) <= 12),
      sentiment: SENTIMENT_WORDS.some((word) => titleLower.includes(word)),
      power: POWER_WORDS.some((word) => titleLower.includes(word)),
      numberInTitle: /\d/.test(titleText),
      shortParagraphs: words === 0 || words < 180 || (html.match(/<p[\s>]/gi) || []).length >= 2,
      richMedia: Boolean(mainImage || gallery.length),
    };
    const basic = [checks.keywordInTitle, checks.keywordInDescription, checks.keywordInUrl, checks.keywordAtStart, checks.keywordInContent, checks.contentLength];
    const additional = [checks.keywordInSubheading, checks.imageAlt, checks.density, checks.urlLength, checks.externalLinks, checks.dofollow, checks.internalLinks, checks.hasKeyword];
    const titleChecks = [checks.keywordNearTitleStart, checks.sentiment, checks.power, checks.numberInTitle];
    const contentChecks = [checks.shortParagraphs, checks.richMedia];
    const all = [...basic, ...additional, ...titleChecks, ...contentChecks];
    const passed = all.filter(Boolean).length;
    return {
      checks,
      words,
      density,
      score: Math.round((passed / all.length) * 100),
      groups: {
        basic: { passed: basic.filter(Boolean).length, total: basic.length },
        additional: { passed: additional.filter(Boolean).length, total: additional.length },
        title: { passed: titleChecks.filter(Boolean).length, total: titleChecks.length },
        content: { passed: contentChecks.filter(Boolean).length, total: contentChecks.length },
      },
    };
  }, [focusKeyword, seoTitle, seoDescription, title, slug, mainImage, imageMeta.alt, gallery.length, shortHtml, descriptionHtml]);

  async function saveForm(targetStatus?: "DRAFT" | "PUBLISHED") {
    if (busy) return;
    if (uploadBusy) {
      notifyError("Wait for the image upload to finish, then save.");
      return;
    }
    const nextStatus = targetStatus || (status === "PUBLISHED" ? "PUBLISHED" : "DRAFT");
    if (!title.trim()) {
      notifyError("Please enter a product name.");
      const titleEl = document.getElementById("product-title-input");
      if (titleEl) {
        titleEl.focus();
        titleEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    if (videoInvalid) {
      notifyError(VIDEO_URL_ERROR);
      document.getElementById("product-video-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const finalSlug = slug.trim() || slugify(title.trim() || "product");
    if (!slug.trim()) setSlug(finalSlug);

    const finalSku = sku.trim() || `ZVM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    if (!sku.trim()) setSku(finalSku);

    const description = descriptionHtml;
    const shortDescription = shortHtml;

    // Redirect: the destination must differ from the old URL.
    const redirectTarget = redirectUrl.trim();
    if (redirectTarget) {
      const pathOf = (value: string) => {
        try {
          const url = new URL(value, "https://zelvomart.com");
          const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
          return /zelvomart\.com$|localhost$/.test(url.hostname) ? path : url.href;
        } catch {
          return value;
        }
      };
      if (pathOf(redirectTarget) === pathOf(redirectFrom.trim() || `/product/${finalSlug}/`)) {
        notifyError("The redirect destination is the same as the old URL. Enter a different destination.");
        setSeoTab("advanced");
        return;
      }
    }

    // Give every variation a stable SKU once, so later saves update the same variation by SKU.
    const usedSkus = new Set(variations.map((item) => item.sku.trim()).filter(Boolean));
    let skuCounter = 1;
    const withSkus = variations.map((item) => {
      if (item.sku.trim()) return { ...item, sku: item.sku.trim() };
      while (usedSkus.has(`${finalSku}-V${skuCounter}`)) skuCounter += 1;
      const generated = `${finalSku}-V${skuCounter}`;
      usedSkus.add(generated);
      return { ...item, sku: generated };
    });
    if (withSkus.some((item, index) => item.sku !== variations[index].sku)) setVariations(withSkus);
    const enabledVariations = withSkus.filter((item) => item.enabled);
    const variationPrices = enabledVariations.map((item) => Number(item.regularPrice || 0)).filter((value) => value > 0);
    const rawPrice = productType === "variable" ? Math.min(...(variationPrices.length ? variationPrices : [Number(regularPrice || 0)])) : Number(regularPrice || 0);
    const price = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : 0;
    if (nextStatus === "PUBLISHED" && price <= 0) {
      notifyError("Add a regular price before posting. Each variation can keep its own price.");
      setActiveTab(productType === "simple" ? "general" : "variations");
      setTimeout(() => {
        const priceEl = document.getElementById("product-regular-price");
        if (priceEl) {
          priceEl.focus();
          priceEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }
    // Saving never overwrites live stock: `stock` is only sent when the admin changed the quantity.
    const simpleTracked = productType === "simple" && trackStock;
    const sendProductStock = simpleTracked && (savedQuantity == null || quantity !== savedQuantity);
    const pricedVariations = enabledVariations.filter((item) => Number(item.regularPrice || item.salePrice || 0) > 0);
    const variantPayload =
      productType === "variable"
        ? pricedVariations.map((item) => {
            const attributes: Record<string, string> = { ...item.attributes };
            delete (attributes as { gallery?: unknown }).gallery;
            const sendStock = item.trackStock && (item.liveQuantity == null || item.sku !== item.liveSku || item.quantity !== item.liveQuantity);
            return {
              name: item.name,
              sku: item.sku,
              trackStock: item.trackStock,
              stockStatus: item.stockStatus,
              ...(sendStock ? { stock: item.quantity } : {}),
              priceOverride: Number(item.salePrice || item.regularPrice || price) || null,
              imageUrl: item.images?.find((src) => src && !src.startsWith("blob:")) || null,
              attributes,
            };
          })
        : [];

    setBusy(true);
    setError("");
    setSavedMessage("");
    const payload = {
      title: title.trim(),
      slug: finalSlug,
      sku: finalSku,
      categoryId: categoryId || null,
      price,
      salePrice: salePrice ? Number(salePrice) : null,
      // A variable product's availability comes from its enabled variations; the parent alone never sells.
      trackStock: productType === "simple" ? trackStock : false,
      stockStatus: productType === "simple" ? stockStatus : "outofstock",
      ...(sendProductStock ? { stock: quantity } : {}),
      status: nextStatus,
      featured: tags.includes("best-selling"),
      previousSlug: initial?.slug && initial.slug !== finalSlug ? initial.slug : undefined,
      redirectFallback,
      bundleEnabled,
      bundleDiscountPercent: 5,
      shortDescription: shortDescription || null,
      descriptionHtml: description || null,
      images: [mainImage, ...gallery].filter((src) => src && !src.startsWith("blob:")),
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      canonicalUrl: canonicalUrl || null,
      videoUrl: video?.url || null,
      variants: variantPayload,
      catalogMeta: {
        productType,
        weight,
        length,
        width,
        height,
        saleFrom,
        saleTo,
        attributes,
        // Stock settings live in the variation rows, not in this JSON.
        variations: withSkus.map(({ open: _open, scheduleOpen: _scheduleOpen, liveSku: _liveSku, liveQuantity: _liveQuantity, trackStock: _track, quantity: _quantity, stockStatus: _status, ...item }) => ({
          ...item,
          images: (item.images || []).filter((src) => src && !src.startsWith("blob:")),
        })),
        swatchesEnabled,
        swatchShape,
        swatchSize,
        bundleEnabled,
        bundleDiscountPercent: 5,
        deliveryDays,
        deliveryNote,
        customTabs,
        productTabs,
        freeShipping,
        focusKeyword,
        badge: badge.trim(),
        tags,
        redirectFallback,
        redirectFrom: redirectFrom.trim(),
        redirectUrl: redirectTarget,
        robotsIndex,
        robotsNoFollow,
        imageMeta,
      },
    };

    try {
      const product = await clientApi<any>(
        initial ? `/api/admin/products/${initial.id}` : "/api/admin/products",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) },
        true,
      );
      setStatus(nextStatus);
      // Show the live stock after saving and use it as the new baseline.
      if (product) {
        const liveStock = wholeQuantity(product.stock);
        setQuantity(liveStock);
        setSavedQuantity(liveStock);
        const liveVariants: any[] = Array.isArray(product.variants) ? product.variants : [];
        setVariations((current) =>
          current.map((item) => {
            const live = liveVariants.find((variant) => variant.sku === item.sku);
            return live ? { ...item, quantity: wholeQuantity(live.stock), liveSku: String(live.sku), liveQuantity: wholeQuantity(live.stock) } : item;
          }),
        );
      }
      const successMsg =
        nextStatus === "PUBLISHED"
          ? "Product published successfully! It is now live in your store."
          : "Product saved as draft successfully.";
      notifySuccess(successMsg);
      clearAdminDataCache("/api/admin/products");
      if (product?.id) clearAdminDataCache(`/api/admin/products/${product.id}`);
      onSaved?.(product);
    } catch (requestError) {
      notifyError(requestError instanceof Error ? requestError.message.replace(/_/g, " ") : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveForm();
  }

  const previewUrl = `https://zelvomart.com/product/${slug || "product-slug"}/`;
  const stockPreview = availability(trackStock, quantity, stockStatus) === "instock" ? "In stock" : "Out of stock";
  const variationAttributes = attributes.filter((item) => item.forVariations && item.name.trim() && parseValues(item.valuesText).length);

  /** The product as the storefront would receive it; used by the preview and the schema tab. */
  function buildPreviewProduct(): Product {
    const visibleImages = [mainImage, ...gallery].filter(Boolean);
    const category = categoryOptions.find((item) => item.id === categoryId);
    const enabled = variations.filter((item) => item.enabled);
    const prices = enabled.map((item) => Number(item.salePrice || item.regularPrice || 0)).filter((value) => value > 0);
    const regular = productType === "variable" ? Math.min(...(prices.length ? prices : [Number(regularPrice || 0)])) : Number(regularPrice || 0);
    const sale = salePrice ? Number(salePrice) : null;
    const current = sale && sale > 0 && regular > 0 && sale < regular ? sale : regular || 0;
    const previewOnSale = Boolean(sale && sale > 0 && regular > sale);
    const previewDiscount = previewOnSale && sale ? Math.round(((regular - sale) / regular) * 100) : 0;
    const preview: Product = {
      id: initial?.id || "preview",
      slug: slug || "preview",
      name: title || "Untitled product",
      sku: sku || "PREVIEW",
      categories: category ? [{ id: category.id, name: category.name, slug: category.slug || slugify(category.name) }] : [],
      categorySlugs: category?.slug ? [category.slug] : [],
      price: current,
      regularPrice: regular || current,
      salePrice: sale,
      onSale: previewOnSale,
      discountPercent: previewDiscount,
      stockStatus:
        productType === "variable" && enabled.length
          ? enabled.some((item) => availability(item.trackStock, item.quantity, item.stockStatus) === "instock")
            ? "instock"
            : "outofstock"
          : availability(trackStock, quantity, stockStatus),
      trackStock: productType === "simple" && trackStock,
      stockQuantity: productType === "simple" && trackStock ? quantity : null,
      freeShipping,
      videoUrl: video?.url || null,
      videoThumbnail: videoThumbnail || null,
      videoAddedAt: video && initial?.videoUrl && parseVideoUrl(initial.videoUrl)?.url === video.url ? initial?.videoAddedAt : new Date().toISOString(),
      createdAt: initial?.createdAt,
      updatedAt: initial?.updatedAt,
      reviewCount: initial?.reviewCount || 0,
      averageRating: initial?.averageRating,
      featured: false,
      image: visibleImages[0],
      images: visibleImages.map((src, index) =>
        index === 0
          ? { src, alt: imageMeta.alt || title || "Product image", ...(imageMeta.title ? { title: imageMeta.title } : {}) }
          : { src, alt: title || "Product image" },
      ),
      imageAlt: imageMeta.alt || null,
      imageTitle: imageMeta.title || null,
      shortDescription: shortHtml,
      description: descriptionHtml,
      permalink: `/product/${slug || "preview"}/`,
      hasOptions: productType === "variable" && enabled.length > 0,
      variants: enabled.map((item, index) => ({
        id: item.key,
        sku: item.sku || `${sku || "PREVIEW"}-V${index + 1}`,
        name: item.name,
        attributes: item.attributes,
        priceOverride: Number(item.salePrice || item.regularPrice || 0) || null,
        regularPrice: item.regularPrice ? Number(item.regularPrice) : null,
        salePrice: item.salePrice ? Number(item.salePrice) : null,
        stock: item.quantity,
        trackStock: item.trackStock,
        stockStatus: availability(item.trackStock, item.quantity, item.stockStatus),
        imageUrl: item.images?.[0] || null,
        images: item.images || [],
        weight: item.weight,
        length: item.length,
        width: item.width,
        height: item.height,
        enabled: item.enabled,
        active: true,
      })),
      bundleEnabled,
      bundleDiscountPercent: 5,
      buyTwoDiscountPercent: 5,
      badges: badgesFromCatalog({ badge, tags, onSale: previewOnSale, discountPercent: previewDiscount }),
      tags,
      reviews: [],
      seoTitle: seoTitle || title,
      seoDescription,
      canonicalUrl,
      catalogMeta: {
        productType,
        weight,
        length,
        width,
        height,
        freeShipping,
        deliveryDays,
        deliveryNote,
        customTabs,
        productTabs,
        attributes,
        variations: enabled,
        swatchesEnabled,
        swatchShape,
        swatchSize,
      },
    };
    return preview;
  }

  function openPreview() {
    const pendingImages = [mainImage, ...gallery, ...variations.flatMap((item) => item.images || [])].some((src) => src.startsWith("blob:"));
    if (uploadBusy || pendingImages) {
      setError("Wait for the images to finish uploading, then open the preview.");
      return;
    }
    const preview = buildPreviewProduct();
    const previewSlug = (slug || slugify(title) || "").trim();
    if (!previewSlug) {
      notifyError("Add a product name before opening the preview.");
      return;
    }
    preview.slug = previewSlug;
    preview.permalink = `/product/${previewSlug}/`;
    const payload = JSON.stringify({ ...preview, previewAt: Date.now() });
    // localStorage so the new tab can read it; sessionStorage stays for the same tab.
    localStorage.setItem("zelvomart-product-preview", payload);
    sessionStorage.setItem("zelvomart-product-preview", payload);
    window.open("/product-preview", "_blank", "noopener");
  }

  return (
    <form ref={formRef} className="pd-form wp-editor-wrap" onSubmit={submit}>
      <div className="wp-editor-grid">
        {/* Main Column */}
        <div className="wp-main-col">
          {/* Title & Permalink */}
          <div className="wp-title-wrap">
            <input
              id="product-title-input"
              className="wp-title-input"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Product name"
              required
            />
            <div className="wp-permalink-row">
              <strong>Permalink:</strong>
              {editingSlug && !publishedSlugLocked ? (
                <input
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(slugify(event.target.value));
                  }}
                  onBlur={() => setEditingSlug(false)}
                  aria-label="Permalink slug"
                />
              ) : (
                <a
                  href="/product-preview"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => {
                    event.preventDefault();
                    openPreview();
                  }}
                >
                  {previewUrl}
                </a>
              )}
              {!publishedSlugLocked ? (
                <button type="button" className="wp-btn-secondary" onClick={() => setEditingSlug((open) => !open)}>
                  {editingSlug ? "OK" : "Edit"}
                </button>
              ) : null}
            </div>
          </div>

          {/* Product description metabox */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("description")}>
              <h3 className="wp-metabox-title">Product description</h3>
              <span className="wp-metabox-toggle">{collapsed.description ? "▾" : "▴"}</span>
            </div>
            {!collapsed.description ? (
              <div className="wp-metabox-body" style={{ padding: 0 }}>
                <AdminRichTextEditor
                  name="descriptionHtml"
                  defaultValue={initial?.descriptionHtml || initial?.description || ""}
                  onChange={setDescriptionHtml}
                  placeholder="Describe the product, materials and how to use it..."
                  onAddMedia={() => galleryRef.current?.click()}
                />
              </div>
            ) : null}
          </div>

          {/* Product data metabox */}
          <section className="wp-metabox">
            <header className="wp-product-data-header">
              <div className="wp-product-data-title-group">
                <strong>Product data &mdash;</strong>
                <select
                  className="wp-product-data-select"
                  value={productType}
                  onChange={(event) => chooseType(event.target.value as ProductType)}
                  aria-label="Product type"
                >
                  <option value="simple">Simple product</option>
                  <option value="variable">Variable product</option>
                </select>
                <span className="wp-help-icon" title="Choose whether this is a simple or variable product">?</span>
              </div>
              <span className="wp-metabox-toggle" onClick={() => toggleCollapse("productData")}>
                {collapsed.productData ? "▾" : "▴"}
              </span>
            </header>
            {!collapsed.productData ? (
              <div className="wp-product-data-body">
                <nav className="wp-data-tabs" aria-label="Product data sections">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`wp-data-tab-item${activeTab === tab.id ? " is-active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <TabIcon id={tab.id} />
                      {tab.label}
                    </button>
                  ))}
                </nav>
                <div className="wp-data-panel-content" key={activeTab}>
                  {activeTab === "general" && productType === "simple" ? (
                    <>
                      <div className="wp-form-row">
                        <label>Regular price (Rs)</label>
                        <div>
                          <input
                            id="product-regular-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={regularPrice}
                            onChange={(event) => setRegularPrice(event.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="wp-form-row">
                        <label>Sale price (Rs)</label>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={salePrice}
                              onChange={(event) => setSalePrice(event.target.value)}
                              placeholder=""
                            />
                            <button
                              type="button"
                              className="wp-link-action"
                              style={{ margin: 0 }}
                              onClick={() => setScheduleOpen((open) => !open)}
                            >
                              Schedule
                            </button>
                          </div>
                          {scheduleOpen ? (
                            <div className="pd-schedule" style={{ marginTop: 8 }}>
                              <label>
                                From
                                <input type="date" value={saleFrom} onChange={(event) => setSaleFrom(event.target.value)} />
                              </label>
                              <label>
                                To
                                <input type="date" value={saleTo} onChange={(event) => setSaleTo(event.target.value)} />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}

              {activeTab === "inventory" ? (
                <>
                  <Field label="SKU">
                    <input
                      value={sku}
                      onChange={(event) => {
                        setSkuTouched(true);
                        setSku(event.target.value.toUpperCase());
                      }}
                      placeholder="ZVM-0001"
                    />
                  </Field>
                  {productType === "variable" ? (
                    <Field label="Stock">
                      <p className="pd-note" style={{ margin: 0 }}>
                        Stock is set on each variation (Variations → Manage stock?). The product shows In stock while at least one enabled variation is in stock.
                      </p>
                    </Field>
                  ) : (
                    <>
                      <Field label="Stock management">
                        <label className="pd-check">
                          <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} />
                          Track stock quantity for this product
                        </label>
                        <p className="pd-side-hint">
                          {trackStock
                            ? "Each order takes its quantity off. At 0 the product turns Out of stock by itself and cannot be ordered."
                            : "Orders do not check or reduce a quantity. The product stays In stock until you pick Out of stock."}
                        </p>
                      </Field>
                      {trackStock ? (
                        <Field label="Quantity">
                          <input type="number" min="0" value={quantity} onChange={(event) => changeQuantity(Number(event.target.value))} />
                        </Field>
                      ) : (
                        <Field label="Stock status">
                          <div className="pd-radios">
                            {[
                              ["instock", "In stock"],
                              ["outofstock", "Out of stock"],
                            ].map(([value, label]) => (
                              <label key={value}>
                                <input type="radio" name="stockStatus" checked={stockStatus === value} onChange={() => changeStockStatus(value as StockStatus)} />
                                {label}
                              </label>
                            ))}
                          </div>
                        </Field>
                      )}
                      <Field label="Shop shows">
                        <p className={`pd-stock-result ${stockPreview === "Out of stock" ? "is-out" : "is-in"}`}>
                          <strong>{stockPreview}</strong>
                          {trackStock ? ` · ${quantity} in stock` : ""}
                        </p>
                      </Field>
                    </>
                  )}
                  <Field label="Bundle offer">
                    <label className="pd-check">
                      <input type="checkbox" checked={bundleEnabled} onChange={(event) => setBundleEnabled(event.target.checked)} />
                      Enable buy-2 bundle
                    </label>
                    <p className="pd-side-hint">Buy 2 charges the pair price with 5% off: price × 2 × 0.95.</p>
                  </Field>
                </>
              ) : null}

              {activeTab === "shipping" ? (
                <>
                  <Field label="Shipping class">
                    <select value={freeShipping ? "free" : "charges"} onChange={(event) => setFreeShipping(event.target.value === "free")}>
                      <option value="charges">Delivery charges</option>
                      <option value="free">Free shipping</option>
                    </select>
                    <p className="pd-side-hint">
                      {freeShipping
                        ? "This product ships free."
                        : `Charged Rs ${deliveryPolicy.flatRate.toLocaleString()} (Settings → Delivery). Orders above Rs ${deliveryPolicy.threshold.toLocaleString()} ship free.`}
                    </p>
                  </Field>
                  <Field label="Weight (kg)">
                    <input type="number" min="0" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="e.g. 0.5" />
                  </Field>
                  <Field label="Dimensions (cm)">
                    <div className="pd-dims">
                      <input value={length} onChange={(event) => setLength(event.target.value)} placeholder="Length" aria-label="Length" />
                      <input value={width} onChange={(event) => setWidth(event.target.value)} placeholder="Width" aria-label="Width" />
                      <input value={height} onChange={(event) => setHeight(event.target.value)} placeholder="Height" aria-label="Height" />
                    </div>
                    <p className="pd-side-hint">Shown on the product page under Additional information when filled.</p>
                  </Field>
                </>
              ) : null}

              {activeTab === "attributes" ? (
                <div className="pd-attr">
                  <p className="pd-note">
                    {productType === "variable"
                      ? "Add details customers can choose, such as Color or Size. Separate each value with a | character. Visible attributes show under the bundle options on the product page."
                      : "Add details for this product, such as Material or Brand. Separate each value with a | character. They show under the bundle options on the product page."}
                  </p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-light"
                    onClick={() =>
                      setAttributes((current) => [
                        ...current,
                        { id: uid("attr"), name: "", valuesText: "", visible: true, forVariations: productType === "variable", open: true },
                      ])
                    }
                  >
                    Add new
                  </button>
                  {!attributes.length ? <p className="pd-note">No attributes yet. Add Color, then Size, and save them to build every combination.</p> : null}
                  {attributes.map((attribute) => (
                    <article className="pd-attr-card" key={attribute.id}>
                      <header>
                        <strong>{attribute.name.trim() || "New attribute"}</strong>
                        <button type="button" className="pd-danger" onClick={() => removeAttribute(attribute.id)}>
                          Remove
                        </button>
                        <button type="button" onClick={() => updateAttribute(attribute.id, { open: !attribute.open })}>
                          {attribute.open ? "Close" : "Edit"}
                        </button>
                      </header>
                      {attribute.open ? (
                        <div className="pd-attr-body">
                          <div className="pd-attr-grid">
                            <label>
                              Name
                              <input
                                value={attribute.name}
                                placeholder="e.g. Color"
                                onChange={(event) => updateAttribute(attribute.id, { name: event.target.value })}
                              />
                            </label>
                            <label>
                              Value(s)
                              <textarea
                                rows={3}
                                value={attribute.valuesText}
                                placeholder="Blue | Black | White | Yellow"
                                onChange={(event) => updateAttribute(attribute.id, { valuesText: event.target.value })}
                              />
                              <small>Separate values with | only. Example: Blue | Black | White</small>
                            </label>
                          </div>
                          <label className="pd-check">
                            <input type="checkbox" checked={attribute.visible} onChange={(event) => updateAttribute(attribute.id, { visible: event.target.checked })} />
                            Visible on the product page
                          </label>
                          {productType === "variable" ? (
                            <label className="pd-check">
                              <input
                                type="checkbox"
                                checked={attribute.forVariations}
                                onChange={(event) => updateAttribute(attribute.id, { forVariations: event.target.checked })}
                              />
                              Used for variations
                            </label>
                          ) : null}
                        </div>
                      ) : (
                        <p className="pd-note">{parseValues(attribute.valuesText).join(" · ") || "Add values, then save."}</p>
                      )}
                    </article>
                  ))}
                  <button type="button" className="admin-btn admin-btn-primary" onClick={saveAttributes}>
                    Save attributes
                  </button>
                </div>
              ) : null}

              {activeTab === "variations" && productType === "variable" ? (
                <div className="pd-var">
                  <div className="pd-var-tools">
                    <button type="button" className="admin-btn admin-btn-light" disabled={!variationAttributes.length} onClick={regenerateVariations}>
                      Regenerate variations
                    </button>
                    <button type="button" className="admin-btn admin-btn-light" disabled={!variationAttributes.length} onClick={addManualVariation}>
                      Add manually
                    </button>
                    <span>{variations.length} variation{variations.length === 1 ? "" : "s"}</span>
                  </div>
                  <p className="pd-note">Each attribute value is paired with every other variation value. Example: Color Black with Size S | M | L creates Black / S, Black / M and Black / L. Price can be edited on each pair.</p>
                  {!variationAttributes.length ? (
                    <div className="pd-var-empty">
                      <p>Add some attributes in the Attributes tab to generate variations. Make sure to check the Used for variations box.</p>
                      <button type="button" className="pd-link" onClick={() => setActiveTab("attributes")}>
                        Go to Attributes
                      </button>
                    </div>
                  ) : null}
                  <div className="pd-var-list">
                    {variations.map((variation) => {
                      const thumb = variation.images?.[0];
                      return (
                        <article className={`pd-var-card ${variation.open ? "is-open" : ""}`} key={variation.key}>
                          <div
                            className="pd-var-row"
                            onClick={(event) => {
                              // The dropdowns, image picker, Edit/Close and Remove handle their own clicks.
                              if ((event.target as HTMLElement).closest("button, select, input, label, a")) return;
                              toggleVariation(variation.key);
                            }}
                          >
                            <button
                              type="button"
                              className="pd-var-thumb"
                              aria-label={`Add images for ${variation.name}`}
                              onClick={() => {
                                setVariationImageKey(variation.key);
                                variationImageRef.current?.click();
                              }}
                            >
                              {thumb ? <img src={thumb} alt="" /> : <span>+</span>}
                              {variation.images.length > 1 ? <em>+{variation.images.length - 1}</em> : null}
                            </button>
                            <div className="pd-var-identity">
                              <strong>{variation.name || "New variation"}</strong>
                              <div className="pd-var-picks">
                                {variationAttributes.map((attribute) => (
                                  <select
                                    key={attribute.id}
                                    value={variation.attributes[attribute.name.trim()] || ""}
                                    aria-label={attribute.name}
                                    onChange={(event) => setVariationOption(variation.key, attribute.name.trim(), event.target.value)}
                                  >
                                    <option value="">Select {attribute.name}</option>
                                    {parseValues(attribute.valuesText).map((value) => (
                                      <option key={value} value={value}>
                                        {value}
                                      </option>
                                    ))}
                                  </select>
                                ))}
                              </div>
                            </div>
                            <div className="pd-var-price-slot">
                              <b>{variation.regularPrice ? `Rs ${variation.regularPrice}` : "No price"}</b>
                              {variation.salePrice ? <small>Sale Rs {variation.salePrice}</small> : null}
                              {/* What the shop shows: with Manage stock ON, quantity 0 is Out of stock automatically. */}
                              {availability(variation.trackStock, variation.quantity, variation.stockStatus) === "instock" ? (
                                <em className="pd-var-stock-tag is-in">In stock{variation.trackStock ? ` · ${variation.quantity}` : ""}</em>
                              ) : (
                                <em className="pd-var-stock-tag is-out">Out of stock</em>
                              )}
                            </div>
                            <div className="pd-var-actions">
                              <button type="button" className={variation.open ? "is-on" : ""} aria-expanded={variation.open} onClick={() => toggleVariation(variation.key)}>
                                {variation.open ? "Close" : "Edit"}
                              </button>
                              <button type="button" className="pd-danger" onClick={() => setVariations((current) => current.filter((item) => item.key !== variation.key))}>
                                Remove
                              </button>
                            </div>
                          </div>
                          {variation.open ? (
                            <div className="pd-var-woo">
                              <div className="pd-var-woo-top">
                                <div className="pd-var-gallery-box">
                                  <div className="pd-var-gallery-head">
                                    <strong>Variation gallery</strong>
                                    <button
                                      type="button"
                                      className="pd-link"
                                      onClick={() => {
                                        setVariationImageKey(variation.key);
                                        variationImageRef.current?.click();
                                      }}
                                    >
                                      {uploadBusy === "variation" && variationImageKey === variation.key ? "Uploading" : "Add images"}
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    className="pd-var-gallery-add"
                                    onClick={() => {
                                      setVariationImageKey(variation.key);
                                      variationImageRef.current?.click();
                                    }}
                                  >
                                    {thumb ? <img src={thumb} alt="" /> : null}
                                    <span>{variation.images.length ? `${variation.images.length} image${variation.images.length === 1 ? "" : "s"}` : "Add variation images"}</span>
                                  </button>
                                  {variation.images.length ? (
                                    <div className="pd-var-film">
                                      {variation.images.map((src) => (
                                        <figure key={src}>
                                          <img src={src} alt="" />
                                          <button
                                            type="button"
                                            aria-label="Remove variation image"
                                            onClick={() => updateVariation(variation.key, { images: variation.images.filter((image) => image !== src) })}
                                          >
                                            ×
                                          </button>
                                        </figure>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="pd-var-woo-fields">
                                  <label>
                                    SKU
                                    <input value={variation.sku} onChange={(event) => updateVariation(variation.key, { sku: event.target.value.toUpperCase() })} />
                                  </label>
                                </div>
                              </div>
                              <div className="pd-var-flags">
                                <label className="pd-check">
                                  <input type="checkbox" checked={variation.enabled} onChange={(event) => updateVariation(variation.key, { enabled: event.target.checked })} />
                                  Enabled
                                </label>
                                <label className="pd-check">
                                  <input type="checkbox" checked={variation.trackStock} onChange={(event) => updateVariation(variation.key, { trackStock: event.target.checked })} />
                                  Manage stock?
                                </label>
                              </div>
                              <div className="pd-variation-grid">
                                <label>
                                  Regular price (Rs)
                                  <input
                                    type="number"
                                    min="0"
                                    value={variation.regularPrice}
                                    placeholder="Variation price (required)"
                                    onChange={(event) => updateVariation(variation.key, { regularPrice: event.target.value })}
                                  />
                                </label>
                                <label>
                                  Sale price (Rs)
                                  <input type="number" min="0" value={variation.salePrice} onChange={(event) => updateVariation(variation.key, { salePrice: event.target.value })} />
                                  <button type="button" className="pd-link" onClick={() => updateVariation(variation.key, { scheduleOpen: !variation.scheduleOpen })}>
                                    Schedule
                                  </button>
                                </label>
                              </div>
                              {variation.scheduleOpen ? (
                                <div className="pd-schedule">
                                  <label>
                                    From
                                    <input type="date" value={variation.saleFrom} onChange={(event) => updateVariation(variation.key, { saleFrom: event.target.value })} />
                                  </label>
                                  <label>
                                    To
                                    <input type="date" value={variation.saleTo} onChange={(event) => updateVariation(variation.key, { saleTo: event.target.value })} />
                                  </label>
                                </div>
                              ) : null}
                              {variation.trackStock ? (
                                <label className="pd-var-stock-status">
                                  Quantity
                                  <input type="number" min="0" value={variation.quantity} onChange={(event) => changeVariationQuantity(variation.key, Number(event.target.value))} />
                                </label>
                              ) : (
                                <label className="pd-var-stock-status">
                                  Stock status
                                  <select
                                    value={variation.stockStatus}
                                    onChange={(event) => changeVariationStatus(variation.key, event.target.value as StockStatus)}
                                  >
                                    <option value="instock">In stock</option>
                                    <option value="outofstock">Out of stock</option>
                                  </select>
                                </label>
                              )}
                              <div className="pd-variation-grid">
                                <label>
                                  Weight (kg)
                                  <input type="number" min="0" step="0.01" value={variation.weight} onChange={(event) => updateVariation(variation.key, { weight: event.target.value })} />
                                </label>
                                <label>
                                  Dimensions (L × W × H, cm)
                                  <div className="pd-dims">
                                    <input value={variation.length} onChange={(event) => updateVariation(variation.key, { length: event.target.value })} placeholder="Length" aria-label="Length" />
                                    <input value={variation.width} onChange={(event) => updateVariation(variation.key, { width: event.target.value })} placeholder="Width" aria-label="Width" />
                                    <input value={variation.height} onChange={(event) => updateVariation(variation.key, { height: event.target.value })} placeholder="Height" aria-label="Height" />
                                  </div>
                                </label>
                              </div>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  <input
                    ref={variationImageRef}
                    hidden
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      void uploadFiles(Array.from(event.target.files || []), "variation");
                      event.target.value = "";
                    }}
                  />
                </div>
              ) : null}

              {activeTab === "swatches" ? (
                <>
                  <Field label="Swatches">
                    <label className="pd-check">
                      <input type="checkbox" checked={swatchesEnabled} onChange={(event) => setSwatchesEnabled(event.target.checked)} />
                      Show attribute swatches on the product page
                    </label>
                  </Field>
                  <Field label="Shape">
                    <select value={swatchShape} onChange={(event) => setSwatchShape(event.target.value)}>
                      <option value="circle">Circle</option>
                      <option value="rounded">Rounded</option>
                      <option value="square">Square</option>
                    </select>
                  </Field>
                  <Field label="Size">
                    <select value={swatchSize} onChange={(event) => setSwatchSize(event.target.value)}>
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </Field>
                  <div className="pd-swatch-preview">
                    {parseValues(attributes[0]?.valuesText || "Black | White | Blue").map((value) => (
                      <span key={value} className={`pd-swatch is-${swatchShape} is-${swatchSize}`} title={value}>
                        {value.slice(0, 1)}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}

              {activeTab === "delivery" ? (
                <>
                  <Field label="Delivery window (days)">
                    <input type="number" min="1" value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} />
                  </Field>
                  <Field label="Delivery message">
                    <input value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} />
                  </Field>
                </>
              ) : null}

              {activeTab === "tabs" ? (
                <div className="pd-stack pd-product-tabs">
                  <p className="pd-note">Why Choose, Shipping Process and General FAQ for this product are edited here. Leave a section off to keep the store-wide text. Turn a section on to write copy for this product only.</p>
                  {PRODUCT_TAB_DEFS.map((tab) => {
                    const current = productTabs[tab.key];
                    const global = globalTabs[tab.key];
                    const isOpen = openProductTab === tab.key;
                    return (
                      <div className="rankmath-checklist-group pd-acc" key={tab.key}>
                        <button
                          type="button"
                          className="rankmath-checklist-header"
                          aria-expanded={isOpen}
                          onClick={() => setOpenProductTab((open) => (open === tab.key ? null : tab.key))}
                        >
                          <span className="rankmath-checklist-title">
                            <span>{global.title}</span>
                            <span className={`pd-acc-state${current.override ? " is-custom" : ""}`}>{current.override ? "Custom text" : "Store-wide text"}</span>
                          </span>
                          <span style={{ fontSize: 13, color: "var(--adm-text-muted)" }}>{isOpen ? "▴" : "▾"}</span>
                        </button>
                        {isOpen ? (
                        <div className="pd-acc-body">
                        <label className="pd-check">
                          <input
                            type="checkbox"
                            checked={current.override}
                            onChange={(event) => {
                              const override = event.target.checked;
                              setProductTabs((existing) => ({
                                ...existing,
                                [tab.key]: {
                                  override,
                                  content: override ? existing[tab.key].content || global.content : existing[tab.key].content,
                                },
                              }));
                            }}
                          />
                          Use custom content for this product
                        </label>
                        {current.override ? (
                          <AdminRichTextEditor
                            key={`${tab.key}-custom`}
                            name={`product-tab-${tab.key}`}
                            defaultValue={current.content || global.content}
                            onChange={(value) =>
                              setProductTabs((existing) => ({
                                ...existing,
                                [tab.key]: { ...existing[tab.key], content: value },
                              }))
                            }
                            placeholder={`Write the ${global.title} section for this product`}
                          />
                        ) : (
                          <div className="pd-tab-preview" dangerouslySetInnerHTML={{ __html: global.content }} />
                        )}
                        </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

          {/* Product Short Description Metabox */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("shortDescription")}>
              <h3 className="wp-metabox-title">Product short description</h3>
              <span className="wp-metabox-toggle">{collapsed.shortDescription ? "▾" : "▴"}</span>
            </div>
            {!collapsed.shortDescription ? (
              <div className="wp-metabox-body" style={{ padding: 0 }}>
                <AdminRichTextEditor
                  name="shortDescription"
                  defaultValue={initial?.shortDescription || ""}
                  onChange={setShortHtml}
                  placeholder="Two short lines, then ✓ bullets for the key benefits..."
                  compact
                  tickBullets
                  onAddMedia={() => galleryRef.current?.click()}
                />
              </div>
            ) : null}
          </div>

          {/* Product SEO Metabox (Rank Math Style) */}
          <section className="rankmath-box">
            <header className="rankmath-header">
              <div className="rankmath-title-area">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#1b63ff" }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <h3 className="wp-metabox-title" style={{ margin: 0 }}>Product SEO</h3>
                </div>

                <div className={`rankmath-badge-score ${seo.score >= 80 ? "score-good" : seo.score >= 50 ? "score-fair" : "score-poor"}`}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "currentColor" }} />
                  {seo.score} / 100
                </div>

                <div className="rankmath-tabs">
                  {(["general", "advanced", "schema"] as SeoTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`rankmath-tab-btn${seoTab === tab ? " is-active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSeoTab(tab);
                      }}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <span className="wp-metabox-toggle" onClick={() => toggleCollapse("seo")} style={{ cursor: "pointer" }}>
                {collapsed.seo ? "▾" : "▴"}
              </span>
            </header>

            {!collapsed.seo ? (
              <div style={{ padding: 20 }}>
                {/* 1. GENERAL TAB */}
                {seoTab === "general" ? (
                  <>
                    {/* Google SERP Card */}
                    <div className="rankmath-serp-card">
                      <div className="rankmath-serp-meta">
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-main)" }}>Google Search Preview</span>
                          <div className="rankmath-serp-device-switch">
                            <button
                              type="button"
                              className={`rankmath-serp-device-btn ${previewDevice === "desktop" ? "is-active" : ""}`}
                              onClick={() => setPreviewDevice("desktop")}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                              Desktop
                            </button>
                            <button
                              type="button"
                              className={`rankmath-serp-device-btn ${previewDevice === "mobile" ? "is-active" : ""}`}
                              onClick={() => setPreviewDevice("mobile")}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                              Mobile
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="wp-btn-secondary"
                          onClick={() => setInlineSnippetOpen((prev) => !prev)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, height: 32, padding: "0 12px" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                          {inlineSnippetOpen ? "Close Snippet" : "Edit Snippet"}
                        </button>
                      </div>

                      {/* Real Google SERP Visual */}
                      <div className={`rankmath-serp-google ${previewDevice === "mobile" ? "is-mobile" : ""}`}>
                        <div className="rankmath-serp-header">
                          <span className="rankmath-serp-favicon">Z</span>
                          <div>
                            <div className="rankmath-serp-site">Zelvomart</div>
                            <div className="rankmath-serp-url">{previewUrl}</div>
                          </div>
                        </div>
                        <h4 className="rankmath-serp-title" onClick={() => setInlineSnippetOpen(true)}>
                          {seoTitle || title || "Product Title"}
                        </h4>
                        <p className="rankmath-serp-desc">
                          {seoDescription || plainText(shortHtml) || "Add a meta description so search results explain this product clearly to potential shoppers."}
                        </p>
                      </div>

                      {/* Rank Math Inline Snippet Editor Drawer */}
                      {inlineSnippetOpen ? (
                        <div className="rankmath-snippet-editor">
                          <div className="rankmath-input-group">
                            <label className="rankmath-input-label">
                              <span>SEO Title</span>
                              <div className="rankmath-progress-wrap">
                                <span>{(seoTitle || title).length} / 60</span>
                                <div className="rankmath-progress-bar">
                                  <div
                                    className="rankmath-progress-fill"
                                    style={{
                                      width: `${Math.min(100, ((seoTitle || title).length / 60) * 100)}%`,
                                      backgroundColor: (seoTitle || title).length >= 40 && (seoTitle || title).length <= 60 ? "#10b981" : (seoTitle || title).length > 60 ? "#ef4444" : "#f59e0b",
                                    }}
                                  />
                                </div>
                              </div>
                            </label>
                            <input
                              className="wp-form-row"
                              style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13, background: "#fff" }}
                              value={seoTitle}
                              maxLength={120}
                              onChange={(e) => setSeoTitle(e.target.value)}
                              placeholder={title || "SEO Title"}
                            />
                            <small style={{ fontSize: 11, color: "var(--adm-text-muted)" }}>Optimal title length is between 40 and 60 characters.</small>
                          </div>

                          <div className="rankmath-input-group">
                            <label className="rankmath-input-label">
                              <span>Permalink Slug</span>
                              <div className="rankmath-progress-wrap">
                                <span>{slug.length} / 75</span>
                                <div className="rankmath-progress-bar">
                                  <div
                                    className="rankmath-progress-fill"
                                    style={{
                                      width: `${Math.min(100, (slug.length / 75) * 100)}%`,
                                      backgroundColor: slug.length <= 75 ? "#10b981" : "#ef4444",
                                    }}
                                  />
                                </div>
                              </div>
                            </label>
                            <input
                              style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13, background: "#fff" }}
                              value={slug}
                              readOnly={publishedSlugLocked}
                              onChange={(e) => {
                                setSlugTouched(true);
                                setSlug(slugify(e.target.value));
                              }}
                              placeholder="product-slug"
                            />
                          </div>

                          <div className="rankmath-input-group">
                            <label className="rankmath-input-label">
                              <span>Meta Description</span>
                              <div className="rankmath-progress-wrap">
                                <span>{seoDescription.length} / 160</span>
                                <div className="rankmath-progress-bar">
                                  <div
                                    className="rankmath-progress-fill"
                                    style={{
                                      width: `${Math.min(100, (seoDescription.length / 160) * 100)}%`,
                                      backgroundColor: seoDescription.length >= 120 && seoDescription.length <= 160 ? "#10b981" : seoDescription.length > 160 ? "#ef4444" : "#f59e0b",
                                    }}
                                  />
                                </div>
                              </div>
                            </label>
                            <textarea
                              rows={3}
                              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13, background: "#fff", resize: "vertical" }}
                              value={seoDescription}
                              maxLength={220}
                              onChange={(e) => setSeoDescription(e.target.value)}
                              placeholder="Add an enticing meta description to increase click-through rates from search results..."
                            />
                            <small style={{ fontSize: 11, color: "var(--adm-text-muted)" }}>Optimal description length is between 120 and 160 characters.</small>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Focus Keyword Card */}
                    <div className="rankmath-focus-box">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-main)" }}>Focus Keyword</span>
                          {focusKeyword ? <span className="rankmath-keyword-pill">{focusKeyword}</span> : null}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--adm-text-muted)" }}>{focusKeyword.length} / 100 chars</span>
                      </div>
                      <input
                        style={{ width: "100%", height: 42, padding: "8px 14px", borderRadius: 10, border: "1px solid var(--adm-border)", fontSize: 13, background: "#fff", outline: "none" }}
                        value={focusKeyword}
                        maxLength={100}
                        onChange={(event) => setFocusKeyword(event.target.value)}
                        placeholder="e.g. casual cotton t-shirt"
                      />
                      <small style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--adm-text-muted)" }}>
                        Pick the main search query you want this product to rank for. Rank Math checks your content against this keyword.
                      </small>
                    </div>

                    {/* Rank Math Checklists */}
                    <SeoGroup title="Basic SEO" meta={seo.groups.basic} open={openSeoGroup === "basic"} onToggle={() => toggleSeoGroup("basic")}>
                      <Check ok={seo.checks.keywordInTitle} text="Add Focus Keyword to the SEO title." />
                      <Check ok={seo.checks.keywordInDescription} text="Add Focus Keyword to your SEO meta description." />
                      <Check ok={seo.checks.keywordInUrl} text="Use Focus Keyword in the product URL / permalink." />
                      <Check ok={seo.checks.keywordAtStart} text="Use Focus Keyword at the beginning of your content." />
                      <Check ok={seo.checks.keywordInContent} text="Use Focus Keyword inside the product description." />
                      <Check ok={seo.checks.contentLength} text={`Content should be 600–2500 words long (Currently ${seo.words} words).`} />
                    </SeoGroup>

                    <SeoGroup title="Additional SEO" meta={seo.groups.additional} open={openSeoGroup === "additional"} onToggle={() => toggleSeoGroup("additional")}>
                      <Check ok={seo.checks.keywordInSubheading} text="Use Focus Keyword in a subheading (H2, H3, or H4)." />
                      <Check ok={seo.checks.imageAlt} text="Use Focus Keyword in product image ALT attribute." />
                      <Check ok={seo.checks.density} text={`Keyword density is ${seo.density.toFixed(2)}% (Optimal: ~1.0%).`} />
                      <Check ok={seo.checks.urlLength} text={seo.checks.urlLength ? "URL length looks good (under 75 characters)." : "Keep the URL shorter than 75 characters."} />
                      <Check ok={seo.checks.externalLinks} text="Add external links pointing to helpful resources." />
                      <Check ok={seo.checks.dofollow} text="Add at least one DoFollow external link." />
                      <Check ok={seo.checks.internalLinks} text="Add internal links pointing to related products/categories." />
                      <Check ok={seo.checks.hasKeyword} text="Focus Keyword is configured for this product." />
                    </SeoGroup>

                    <SeoGroup title="Title Readability" meta={seo.groups.title} open={openSeoGroup === "title"} onToggle={() => toggleSeoGroup("title")}>
                      <Check ok={seo.checks.keywordNearTitleStart} text="Focus Keyword appears near the beginning of the SEO title." />
                      <Check ok={seo.checks.sentiment} text="Title contains a positive or enticing sentiment word." />
                      <Check ok={seo.checks.power} text="Title contains a high-converting power word." />
                      <Check ok={seo.checks.numberInTitle} text="Title contains a number (e.g. pack count or discount %)." />
                    </SeoGroup>

                    <SeoGroup title="Content Readability" meta={seo.groups.content} open={openSeoGroup === "content"} onToggle={() => toggleSeoGroup("content")}>
                      <Check ok={seo.checks.shortParagraphs} text="Use short, readable paragraphs for better mobile scanning." />
                      <Check ok={seo.checks.richMedia} text="Product has rich media (photos and gallery images)." />
                    </SeoGroup>
                  </>
                ) : null}

                {/* 2. ADVANCED TAB */}
                {seoTab === "advanced" ? (
                  <div style={{ display: "grid", gap: 18 }}>
                    <div className="wp-form-row">
                      <label>Robots Meta</label>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                          <input type="radio" name="robotsIndex" checked={robotsIndex === "index"} onChange={() => setRobotsIndex("index")} />
                          <span>Index (Recommended)</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                          <input type="radio" name="robotsIndex" checked={robotsIndex === "noindex"} onChange={() => setRobotsIndex("noindex")} />
                          <span>No Index</span>
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", marginLeft: 10 }}>
                          <input type="checkbox" checked={robotsNoFollow} onChange={(e) => setRobotsNoFollow(e.target.checked)} />
                          <span>No Follow</span>
                        </label>
                      </div>
                    </div>

                    <div className="wp-form-row">
                      <label>Canonical URL</label>
                      <div style={{ width: "100%" }}>
                        <input
                          style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13 }}
                          value={canonicalUrl}
                          onChange={(e) => setCanonicalUrl(e.target.value)}
                          placeholder="https://zelvomart.com/product/..."
                        />
                        <small style={{ fontSize: 11, color: "var(--adm-text-muted)", display: "block", marginTop: 4 }}>
                          The canonical URL tells search engines which page is the master copy if this product exists in multiple categories.
                        </small>
                      </div>
                    </div>

                    <div className="wp-form-row">
                      <label>Redirect: Old URL</label>
                      <div style={{ width: "100%" }}>
                        <input
                          style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13 }}
                          value={redirectFrom}
                          onChange={(e) => setRedirectFrom(e.target.value)}
                          placeholder={`/product/${slug || "product-slug"}/`}
                        />
                        <small style={{ fontSize: 11, color: "var(--adm-text-muted)", display: "block", marginTop: 4 }}>
                          The deleted or old page path. Starts as this product&apos;s URL; can be any old path, such as an old WordPress URL.
                        </small>
                      </div>
                    </div>

                    <div className="wp-form-row">
                      <label>Redirect: Destination URL</label>
                      <div style={{ width: "100%" }}>
                        <input
                          style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13 }}
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          placeholder="/product/replacement-item/"
                        />
                        <small style={{ fontSize: 11, color: "var(--adm-text-muted)", display: "block", marginTop: 4 }}>
                          Where visitors of the old URL go (301). Leave empty for no redirect. Saved in Admin → SEO Redirects.
                        </small>
                      </div>
                    </div>

                    <div className="wp-form-row">
                      <label>Redirect Fallback</label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input type="checkbox" checked={redirectFallback} onChange={(e) => setRedirectFallback(e.target.checked)} />
                        <span style={{ fontSize: 13 }}>Send shoppers to <code>/shop</code> if product link is broken or unpublished</span>
                      </label>
                    </div>
                  </div>
                ) : null}

                {/* 3. SCHEMA TAB (read-only, same builder as the live product page) */}
                {seoTab === "schema" ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-main)" }}>Product Schema (JSON-LD)</span>
                      {initial?.slug && status === "PUBLISHED" ? (
                        <a
                          href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(`https://zelvomart.com/product/${initial.slug}/`)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, fontWeight: 700 }}
                        >
                          Test in Google Rich Results →
                        </a>
                      ) : null}
                    </div>
                    <small style={{ fontSize: 11, color: "var(--adm-text-muted)" }}>
                      Read-only. Built by the same function as the live product page, from the values in this form.
                    </small>
                    <pre style={{ margin: 0, padding: 14, borderRadius: 10, background: "#0b1a2e", color: "#93c5fd", fontSize: 12, lineHeight: 1.6, overflowX: "auto" }}>
                      {JSON.stringify(buildProductSchema(buildPreviewProduct(), { baseUrl: "https://zelvomart.com", delivery: deliveryPolicy }), null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>

        {/* Right Sidebar Column */}
        <aside className="wp-sidebar-col">
          {/* 1. Publish */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("publish")}>
              <h3 className="wp-metabox-title">Publish</h3>
              <span className="wp-metabox-toggle">{collapsed.publish ? "▾" : "▴"}</span>
            </div>
            {!collapsed.publish ? (
              <div className="wp-metabox-body">
                <div className="wp-publish-actions-top">
                  <button
                    type="button"
                    className="wp-publish-btn-outline"
                    disabled={busy}
                    onClick={() => void saveForm("DRAFT")}
                  >
                    {busy && status === "DRAFT" ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    className="wp-publish-btn-outline"
                    onClick={openPreview}
                  >
                    Preview
                  </button>
                </div>
                <div className="wp-publish-meta-row">
                  <span>📌 Status: <strong>{status === "PUBLISHED" ? "Published" : "Draft"}</strong></span>
                  <button
                    type="button"
                    className="wp-link-action"
                    style={{ margin: 0 }}
                    onClick={() => setStatus((current) => (current === "PUBLISHED" ? "DRAFT" : "PUBLISHED"))}
                  >
                    Edit
                  </button>
                </div>
                <div className="wp-publish-meta-row">
                  <span>👁 Visibility: <strong>Public</strong></span>
                  <span className="wp-link-action" style={{ margin: 0 }}>Edit</span>
                </div>
                <div className="wp-publish-actions-bottom">
                  <button
                    type="button"
                    className="wp-btn-trash"
                    onClick={() => window.history.back()}
                  >
                    Move to trash
                  </button>
                  <button
                    type="submit"
                    className="wp-btn-publish"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      void saveForm("PUBLISHED");
                    }}
                  >
                    {busy && status === "PUBLISHED" ? "Saving..." : initial?.id ? "Update" : "Publish"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* 2. Product image */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("mainImage")}>
              <h3 className="wp-metabox-title">Product image</h3>
              <span className="wp-metabox-toggle">{collapsed.mainImage ? "▾" : "▴"}</span>
            </div>
            {!collapsed.mainImage ? (
              <div className="wp-metabox-body">
                <input
                  ref={mainImageRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) rememberImageFile(file);
                    void uploadFiles(Array.from(event.target.files || []).slice(0, 1), "main");
                    event.target.value = "";
                  }}
                />
                {mainImage ? (
                  <div className="pd-main-image">
                    <img src={mainImage} alt={imageMeta.alt || title || "Product image"} />
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="wp-btn-secondary" onClick={() => setImageEditorOpen(true)}>Edit details</button>
                      <button type="button" className="wp-btn-secondary" onClick={() => mainImageRef.current?.click()}>{uploadBusy === "main" ? "Uploading..." : "Replace"}</button>
                      <button type="button" className="wp-btn-secondary" style={{ color: "#b32d2e" }} onClick={() => { setMainImage(""); setImageMeta(EMPTY_IMAGE_META); }}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className="wp-link-action"
                      style={{ marginTop: 0 }}
                      onClick={() => mainImageRef.current?.click()}
                    >
                      {uploadBusy === "main" ? "Uploading..." : "Set product image"}
                    </button>
                    <span className="wp-help-icon" title="Featured primary product image">?</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 3. Product gallery */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("gallery")}>
              <h3 className="wp-metabox-title">Product gallery</h3>
              <span className="wp-metabox-toggle">{collapsed.gallery ? "▾" : "▴"}</span>
            </div>
            {!collapsed.gallery ? (
              <div className="wp-metabox-body">
                <input
                  ref={galleryRef}
                  hidden
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    void uploadFiles(Array.from(event.target.files || []), "gallery");
                    event.target.value = "";
                  }}
                />
                {gallery.length ? (
                  <div className="pd-gallery" style={{ marginBottom: 12 }}>
                    {gallery.map((src) => (
                      <figure key={src}>
                        <img src={src} alt="" />
                        <button
                          type="button"
                          aria-label="Remove gallery image"
                          onClick={() => setGallery((current) => current.filter((item) => item !== src))}
                        >
                          ×
                        </button>
                      </figure>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="wp-link-action"
                    style={{ marginTop: 0 }}
                    onClick={() => galleryRef.current?.click()}
                  >
                    {uploadBusy === "gallery" ? "Uploading..." : gallery.length ? "Add more gallery images" : "Add product gallery images"}
                  </button>
                  <span className="wp-help-icon" title="Product gallery images displayed in product image slider">?</span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Product video (link only, shown as the last gallery thumbnail on the product page) */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("video")}>
              <h3 className="wp-metabox-title">Product video</h3>
              <span className="wp-metabox-toggle">{collapsed.video ? "▾" : "▴"}</span>
            </div>
            {!collapsed.video ? (
              <div className="wp-metabox-body pd-video-box">
                {video ? (
                  videoPreviewPlaying ? (
                    <div className="pd-video-preview">
                      <iframe
                        src={video.embedUrl}
                        title="Product video preview"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <button type="button" className="pd-video-preview" onClick={() => setVideoPreviewPlaying(true)} aria-label="Play video preview">
                      {videoThumbnail ? <img src={videoThumbnail} alt="Video thumbnail" /> : <div className="pd-video-placeholder">{video.provider === "vimeo" ? "Vimeo video" : "Video"}</div>}
                      <span className="pd-video-play" aria-hidden="true">▶</span>
                      <small>{video.provider === "youtube" ? "YouTube" : "Vimeo"}</small>
                    </button>
                  )
                ) : null}
                <input
                  id="product-video-input"
                  className={videoInvalid ? "is-invalid" : ""}
                  value={videoInput}
                  onChange={(event) => setVideoInput(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  aria-invalid={videoInvalid}
                  aria-describedby="product-video-help"
                />
                {videoInvalid ? (
                  <p className="pd-video-error" role="alert">{VIDEO_URL_ERROR}</p>
                ) : (
                  <p className="pd-side-hint" id="product-video-help">
                    Paste a YouTube (youtube.com/watch, youtu.be, youtube.com/shorts) or Vimeo link. Links only, no uploads. It shows as the last thumbnail on the product page.
                  </p>
                )}
                {videoInput ? (
                  <button type="button" className="wp-btn-secondary" style={{ color: "#b32d2e", width: "fit-content" }} onClick={() => setVideoInput("")}>
                    Remove video
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* 3. Product categories */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("categories")}>
              <h3 className="wp-metabox-title">Product categories</h3>
              <span className="wp-metabox-toggle">{collapsed.categories ? "▾" : "▴"}</span>
            </div>
            {!collapsed.categories ? (
              <div className="wp-metabox-body">
                <div className="wp-tabs">
                  <button
                    type="button"
                    className={`wp-tab-btn ${catTab === "all" ? "is-active" : ""}`}
                    onClick={() => setCatTab("all")}
                  >
                    All categories
                  </button>
                  <button
                    type="button"
                    className={`wp-tab-btn ${catTab === "mostUsed" ? "is-active" : ""}`}
                    onClick={() => setCatTab("mostUsed")}
                  >
                    Most Used
                  </button>
                </div>
                <div className="wp-scroll-checklist">
                  {categoryOptions.length ? (
                    categoryOptions.map((category) => (
                      <label key={category.id} className="wp-check-label">
                        <input
                          type="checkbox"
                          checked={categoryId === category.id}
                          onChange={() => setCategoryId((current: string) => (current === category.id ? "" : category.id))}
                        />
                        <span>{category.name}</span>
                      </label>
                    ))
                  ) : (
                    <p className="pd-side-hint" style={{ margin: 0 }}>No categories found.</p>
                  )}
                </div>
                {!showNewCatInput ? (
                  <button
                    type="button"
                    className="wp-link-action"
                    onClick={() => setShowNewCatInput(true)}
                  >
                    + Add new category
                  </button>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      value={newCategory}
                      onChange={(event) => setNewCategory(event.target.value)}
                      placeholder="New category name"
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #8c8f94",
                        borderRadius: 3,
                        fontSize: 13,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void createCategory();
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={() => void createCategory()}
                        disabled={addingCategory || !newCategory.trim()}
                      >
                        {addingCategory ? "Adding..." : "Add"}
                      </button>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={() => {
                          setShowNewCatInput(false);
                          setNewCategory("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* 4. Product tags & badges */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("tags")}>
              <h3 className="wp-metabox-title">Product tags &amp; badges</h3>
              <span className="wp-metabox-toggle">{collapsed.tags ? "▾" : "▴"}</span>
            </div>
            {!collapsed.tags ? (
              <div className="wp-metabox-body">
                <label className="pd-focus" style={{ marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-main)" }}>Badge on photo</span>
                  <input
                    value={badge}
                    maxLength={40}
                    onChange={(event) => setBadge(event.target.value)}
                    placeholder="e.g. Customer favourite"
                    style={{ width: "100%", padding: "7px 12px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-sm)", fontSize: 13 }}
                  />
                  <small style={{ color: "var(--adm-text-muted)", marginTop: 4, display: "block" }}>
                    Shown directly on the center badge of this product photo.
                  </small>
                </label>

                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--adm-text-main)" }}>Collection Tags</span>
                </div>
                <div className="pd-tags" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tagList.map((tag) => {
                    const selected = tags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={selected ? "is-on" : ""}
                        aria-pressed={selected}
                        onClick={() =>
                          setTags((current) =>
                            current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id],
                          )
                        }
                      >
                        <strong>{tag.label}</strong>
                        <small>{tag.hint}</small>
                      </button>
                    );
                  })}
                </div>

                {!showAddTag ? (
                  <button
                    type="button"
                    className="wp-link-action"
                    style={{ marginTop: 12 }}
                    onClick={() => setShowAddTag(true)}
                  >
                    + Add New Tag
                  </button>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      placeholder="New tag name (e.g. Mega Deal)"
                      style={{
                        padding: "6px 12px",
                        border: "1px solid var(--adm-border)",
                        borderRadius: "var(--adm-radius-sm)",
                        fontSize: 13,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addNewTag();
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={addNewTag}
                        disabled={!newTagInput.trim()}
                      >
                        Add Tag
                      </button>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={() => {
                          setShowAddTag(false);
                          setNewTagInput("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

        </aside>
      </div>

      {snippetOpen ? (
        <div className="pd-modal-back" role="presentation" onClick={() => setSnippetOpen(false)}>
          <div className="pd-modal" role="dialog" aria-modal="true" aria-labelledby="snippet-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="snippet-title">Preview Snippet Editor</h2>
              <button type="button" onClick={() => setSnippetOpen(false)} aria-label="Close snippet editor">×</button>
            </header>
            <div className="pd-snippet pd-snippet-live">
              <span>Preview</span>
              <strong>{seoTitle || title || "Product title"}</strong>
              <a
                href="/product-preview"
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.preventDefault();
                  openPreview();
                }}
              >
                {previewUrl}
              </a>
              <p>{seoDescription || "This is what will appear as the description when this product shows up in the search results."}</p>
              <small>zelvomart</small>
            </div>
            <label>
              <span>Title <b>{seoTitle.length} / 60</b></span>
              <input value={seoTitle} maxLength={180} onChange={(event) => setSeoTitle(event.target.value)} placeholder={title || "%title%"} />
              <small>This is what will appear in the first line when this product shows up in the search results.</small>
            </label>
            <label>
              <span>Permalink <b>{slug.length} / 75</b></span>
              <input
                value={slug}
                readOnly={publishedSlugLocked}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
              />
              <small>This is the unique URL of this page, displayed below the product title in the search results.</small>
            </label>
            <label>
              <span>Description <b>{seoDescription.length} / 160</b></span>
              <textarea rows={4} maxLength={320} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Write the search description" />
              <small>This is what will appear as the description when this product shows up in the search results.</small>
            </label>
            <footer>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setSnippetOpen(false)}>Save snippet</button>
            </footer>
          </div>
        </div>
      ) : null}

      {imageEditorOpen ? (
        <div className="pd-modal-back" role="presentation" onClick={() => setImageEditorOpen(false)}>
          <div className="pd-modal pd-media" role="dialog" aria-modal="true" aria-labelledby="image-editor-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="image-editor-title">Product image</h2>
              <button type="button" onClick={() => setImageEditorOpen(false)} aria-label="Close image details">×</button>
            </header>
            {mainImage ? <img src={mainImage} alt={imageMeta.alt || ""} /> : <p className="pd-side-hint">Choose an image to fill in these details. The product can still be saved without one.</p>}
            <p className="pd-media-meta">
              {imageMeta.fileName || "Image"}
              {imageMeta.fileSize ? ` · ${imageMeta.fileSize < 1024 * 1024 ? `${Math.max(1, Math.round(imageMeta.fileSize / 1024))} KB` : `${(imageMeta.fileSize / (1024 * 1024)).toFixed(1)} MB`}` : ""}
              {imageMeta.width && imageMeta.height ? ` · ${imageMeta.width} by ${imageMeta.height} pixels` : ""}
            </p>
            <label>
              Alt text
              <textarea rows={3} value={imageMeta.alt} onChange={(event) => setImageMeta((current) => ({ ...current, alt: event.target.value }))} placeholder="Describe the purpose of the image" />
              <small>Leave empty if the image is purely decorative.</small>
            </label>
            <label>
              Image title
              <input value={imageMeta.title} onChange={(event) => setImageMeta((current) => ({ ...current, title: event.target.value }))} />
              <small>Shown as a tooltip when shoppers hover the product photo.</small>
            </label>
            <label>
              File URL
              <input readOnly value={mainImage} />
            </label>
            <div className="pd-media-actions">
              <button
                type="button"
                className="admin-btn admin-btn-light"
                onClick={() => {
                  if (!mainImage) return;
                  void navigator.clipboard.writeText(mainImage).then(
                    () => setSavedMessage("Image URL copied."),
                    () => setError("Could not copy the image URL."),
                  );
                }}
              >
                Copy URL to clipboard
              </button>
            </div>
            <footer>
              <button type="button" className="admin-btn admin-btn-light" onClick={() => mainImageRef.current?.click()}>Replace image</button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => setImageEditorOpen(false)}>Set product image</button>
            </footer>
          </div>
        </div>
      ) : null}

    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pd-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function SeoGroup({
  title,
  meta,
  open,
  onToggle,
  children,
}: {
  title: string;
  meta: { passed: number; total: number };
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const errors = meta.total - meta.passed;
  return (
    <div className="rankmath-checklist-group">
      <button type="button" className="rankmath-checklist-header" aria-expanded={open} onClick={onToggle}>
        <div className="rankmath-checklist-title">
          <span>{title}</span>
          <span className={`rankmath-checklist-badge ${errors ? "has-errors" : "all-passed"}`}>
            {errors ? `${errors} ${errors === 1 ? "issue" : "issues"}` : "All passed"}
          </span>
        </div>
        <span style={{ fontSize: 13, color: "var(--adm-text-muted)" }}>{open ? "▴" : "▾"}</span>
      </button>
      {open ? <div className="rankmath-checklist-items">{children}</div> : null}
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="rankmath-check-item">
      <span className={`rankmath-check-icon ${ok ? "is-pass" : "is-fail"}`}>{ok ? "✓" : "✕"}</span>
      <span>{text}</span>
    </div>
  );
}
