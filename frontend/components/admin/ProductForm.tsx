"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AdminRichTextEditor from "./AdminRichTextEditor";
import { clearAdminDataCache, useAdminData } from "./useAdminData";
import { clientApi, uploadAdminImage } from "@/lib/client-api";
import { badgesFromCatalog } from "@/lib/product-badges";
import { PRODUCT_TAB_DEFS, mergeGlobalProductTabs, readProductTabOverrides, type ProductTabKey, type ProductTabOverride } from "@/lib/product-tabs";
import type { Product } from "@/types/product";
import { toast } from "react-toastify";

type Category = { id: string; name: string; slug?: string };
type ProductType = "simple" | "variable";
type StockStatus = "instock" | "outofstock" | "onbackorder";
type DataTab =
  | "general"
  | "inventory"
  | "shipping"
  | "linked"
  | "attributes"
  | "variations"
  | "google"
  | "facebook"
  | "tabs"
  | "swatches"
  | "advanced"
  | "delivery";
type SeoTab = "general" | "advanced" | "social" | "schema";
type ImageMeta = {
  alt: string;
  title: string;
  caption: string;
  description: string;
  excludeFromSitemap: boolean;
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
  caption: "",
  description: "",
  excludeFromSitemap: false,
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
  trackStock: boolean;
  quantity: number;
  stockStatus: StockStatus;
  weight: string;
  length: string;
  width: string;
  height: string;
  shippingClass: string;
  images: string[];
  enabled: boolean;
  downloadable: boolean;
  virtual: boolean;
  open: boolean;
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
  { id: "linked", label: "Linked Products" },
  { id: "attributes", label: "Attributes" },
  { id: "advanced", label: "Advanced" },
  { id: "tabs", label: "Product Tabs" },
];

const VARIABLE_TABS: { id: DataTab; label: string }[] = [
  { id: "inventory", label: "Inventory" },
  { id: "shipping", label: "Shipping" },
  { id: "linked", label: "Linked Products" },
  { id: "attributes", label: "Attributes" },
  { id: "variations", label: "Variations" },
  { id: "advanced", label: "Advanced" },
  { id: "tabs", label: "Product Tabs" },
];

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

function stockFrom(status: StockStatus, quantity: number, trackStock = true) {
  if (status === "outofstock") return 0;
  if (!trackStock && status === "instock") return Math.max(1, quantity || 1);
  if (quantity <= 0) return 0;
  return quantity;
}

function catalogLabel(status: StockStatus, quantity: number) {
  if (status === "onbackorder" && quantity > 0) return "On backorder";
  if (status === "instock" && quantity > 0) return "In stock";
  return "Out of stock";
}

function applyQuantity(quantity: number, status: StockStatus) {
  const next = Math.max(0, Math.floor(Number(quantity) || 0));
  if (next <= 0) return { quantity: 0, stockStatus: "outofstock" as StockStatus };
  if (status === "outofstock") return { quantity: next, stockStatus: "instock" as StockStatus };
  return { quantity: next, stockStatus: status };
}

function applyStatus(status: StockStatus, quantity: number) {
  if (status === "outofstock") return { quantity: 0, stockStatus: status };
  if (status === "instock") return { quantity: Math.max(1, quantity), stockStatus: status };
  return { quantity, stockStatus: status };
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
    quantity: 1,
    stockStatus: "instock",
    weight: "",
    length: "",
    width: "",
    height: "",
    shippingClass: "",
    images: [],
    enabled: true,
    downloadable: false,
    virtual: false,
    open,
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
  return rows
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
  if (id === "linked") {
    return (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" />
        <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 20" />
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
  const [trackStock, setTrackStock] = useState(catalog.trackStock !== false);
  const [quantity, setQuantity] = useState<number>(Number(initial?.stock ?? initial?.stockQuantity ?? 1));
  const [stockStatus, setStockStatus] = useState<StockStatus>(catalog.stockStatus || (Number(initial?.stock ?? 1) > 0 ? "instock" : "outofstock"));
  const [weight, setWeight] = useState(catalog.weight || "0");
  const [length, setLength] = useState(catalog.length || "");
  const [width, setWidth] = useState(catalog.width || "");
  const [height, setHeight] = useState(catalog.height || "");
  const [shippingClass, setShippingClass] = useState(catalog.shippingClass || "");
  const [attributes, setAttributes] = useState<AttributeItem[]>(
    (catalog.attributes || []).map((item: AttributeItem) => ({
      ...item,
      visible: item.visible !== false,
      forVariations: item.forVariations !== false,
      open: false,
    })),
  );
  const [variations, setVariations] = useState<VariationItem[]>(
    (catalog.variations || []).map((item: any) => ({
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
      trackStock: Boolean(item.trackStock),
      quantity: Number(item.quantity ?? 1),
      stockStatus: item.stockStatus || "instock",
      weight: item.weight || "",
      length: item.length || "",
      width: item.width || "",
      height: item.height || "",
      shippingClass: item.shippingClass || "",
      images: Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [],
      enabled: item.enabled !== false,
      downloadable: Boolean(item.downloadable),
      virtual: Boolean(item.virtual),
      open: false,
    })),
  );
  const [variationImageKey, setVariationImageKey] = useState<string | null>(null);
  const [swatchShape, setSwatchShape] = useState(catalog.swatchShape || "circle");
  const [swatchSize, setSwatchSize] = useState(catalog.swatchSize || "medium");
  const [swatchesEnabled, setSwatchesEnabled] = useState(catalog.swatchesEnabled !== false);
  const [purchaseNote, setPurchaseNote] = useState(catalog.purchaseNote || "");
  const [menuOrder, setMenuOrder] = useState(catalog.menuOrder || "0");
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
  const [imageMeta, setImageMeta] = useState<ImageMeta>({ ...EMPTY_IMAGE_META, ...(catalog.imageMeta || {}) });
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [brand, setBrand] = useState(catalog.brand || "Hash Deals");
  const [brandList, setBrandList] = useState<string[]>(() => {
    const defaults = ["Hash Deals", "Zelvomart", "Generic"];
    if (catalog.brand && !defaults.includes(catalog.brand)) defaults.push(catalog.brand);
    return defaults;
  });
  const [brandTab, setBrandTab] = useState<"all" | "mostUsed">("all");
  const [newBrandInput, setNewBrandInput] = useState("");
  const [showAddBrand, setShowAddBrand] = useState(false);
  function addBrand() {
    const trimmed = newBrandInput.trim();
    if (!trimmed) return;
    if (!brandList.includes(trimmed)) setBrandList((prev) => [...prev, trimmed]);
    setBrand(trimmed);
    setNewBrandInput("");
    setShowAddBrand(false);
  }
  const [catTab, setCatTab] = useState<"all" | "mostUsed">("all");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [virtual, setVirtual] = useState(Boolean(catalog.virtual));
  const [downloadable, setDownloadable] = useState(Boolean(catalog.downloadable));
  const [taxStatus, setTaxStatus] = useState(catalog.taxStatus || "taxable");
  const [taxClass, setTaxClass] = useState(catalog.taxClass || "standard");
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
  const [uploadBusy, setUploadBusy] = useState<"main" | "gallery" | "variation" | "">("");
  const [descriptionHtml, setDescriptionHtml] = useState(initial?.descriptionHtml || initial?.description || "");
  const [shortHtml, setShortHtml] = useState(initial?.shortDescription || "");
  const [focusKeyword, setFocusKeyword] = useState(catalog.focusKeyword || "");
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription || "");
  const [canonicalUrl, setCanonicalUrl] = useState(initial?.canonicalUrl || "");
  const [snippetOpen, setSnippetOpen] = useState(false);
  const [seoTab, setSeoTab] = useState<SeoTab>("general");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [inlineSnippetOpen, setInlineSnippetOpen] = useState(false);
  const [robotsIndex, setRobotsIndex] = useState<"index" | "noindex">(catalog.robotsIndex || "index");
  const [robotsNoFollow, setRobotsNoFollow] = useState<boolean>(Boolean(catalog.robotsNoFollow));
  const [socialTitle, setSocialTitle] = useState(catalog.socialTitle || "");
  const [socialDescription, setSocialDescription] = useState(catalog.socialDescription || "");
  const [seoOpen, setSeoOpen] = useState({ basic: true, additional: true, title: true, content: true });
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
    setActiveTab(next === "simple" ? "general" : "inventory");
  }

  function changeQuantity(value: number) {
    const next = applyQuantity(value, stockStatus);
    setQuantity(next.quantity);
    setStockStatus(next.stockStatus);
  }

  function changeStockStatus(nextStatus: StockStatus) {
    const next = applyStatus(nextStatus, quantity);
    setQuantity(next.quantity);
    setStockStatus(next.stockStatus);
  }

  function updateVariation(key: string, patch: Partial<VariationItem>) {
    setVariations((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function changeVariationQuantity(key: string, value: number) {
    setVariations((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const next = applyQuantity(value, item.stockStatus);
        return { ...item, quantity: next.quantity, stockStatus: next.stockStatus };
      }),
    );
  }

  function changeVariationStatus(key: string, status: StockStatus) {
    setVariations((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        const next = applyStatus(status, item.quantity);
        return { ...item, quantity: next.quantity, stockStatus: next.stockStatus };
      }),
    );
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
    setVariations((current) => buildVariations(closed, current));
    setError("");
    setActiveTab("variations");
  }

  function addManualVariation() {
    const usable = attributes.filter((item) => item.forVariations && item.name.trim() && parseValues(item.valuesText).length);
    if (!usable.length) {
      setError("Add attributes first, then create variations.");
      setActiveTab("attributes");
      return;
    }
    const attributesMap = Object.fromEntries(usable.map((item) => [item.name.trim(), ""]));
    setVariations((current) => [...current, emptyVariation(attributesMap, true)]);
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
    if (target === "main") setMainImage((current) => (current === previews[0] ? uploaded[0] || previousMain : current));
    if (target === "gallery") setGallery((current) => current.map(swap).filter(Boolean));
    if (target === "variation" && imageKey) {
      setVariations((current) =>
        current.map((item) => (item.key === imageKey ? { ...item, images: (item.images || []).map(swap).filter(Boolean) } : item)),
      );
    }
    previews.forEach((url) => URL.revokeObjectURL(url));
    if (failure) {
      notifyError(failure);
    } else if (uploaded.filter(Boolean).length > 0) {
      notifySuccess(uploaded.filter(Boolean).length === 1 ? "Image uploaded successfully." : `${uploaded.filter(Boolean).length} images uploaded successfully.`);
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

    const finalSlug = slug.trim() || slugify(title.trim() || "product");
    if (!slug.trim()) setSlug(finalSlug);

    const finalSku = sku.trim() || `ZVM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    if (!sku.trim()) setSku(finalSku);

    const description = descriptionHtml;
    const shortDescription = shortHtml;
    const enabledVariations = variations.filter((item) => item.enabled);
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
    const parentStock = stockFrom(stockStatus, quantity, trackStock);
    const variationStock = enabledVariations.reduce((sum, item) => sum + stockFrom(item.stockStatus, item.quantity, item.trackStock), 0);
    const stock = productType === "variable" && enabledVariations.length ? variationStock : parentStock;
    const pricedVariations = enabledVariations.filter((item) => Number(item.regularPrice || item.salePrice || 0) > 0);
    const variantPayload =
      productType === "variable"
        ? pricedVariations.map((item, index) => {
            const attributes = {
              ...item.attributes,
              stockStatus: item.stockStatus,
            };
            delete (attributes as { gallery?: string[] }).gallery;
            return {
              name: item.name,
              sku: item.sku.trim() || `${finalSku}-V${index + 1}`,
              stock: stockFrom(item.stockStatus, item.quantity, item.trackStock),
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
      stock,
      status: nextStatus,
      featured: tags.includes("best-selling"),
      previousSlug: initial?.slug && initial.slug !== finalSlug ? initial.slug : undefined,
      redirectFallback,
      redirectUrl: redirectUrl.trim() || null,
      bundleEnabled,
      bundleDiscountPercent: 5,
      shortDescription: shortDescription || null,
      descriptionHtml: description || null,
      images: [mainImage, ...gallery].filter((src) => src && !src.startsWith("blob:")),
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      canonicalUrl: canonicalUrl || null,
      variants: variantPayload,
      catalogMeta: {
        productType,
        trackStock,
        stockStatus,
        weight,
        length,
        width,
        height,
        shippingClass,
        saleFrom,
        saleTo,
        attributes,
        variations: variations.map(({ open: _open, scheduleOpen: _scheduleOpen, ...item }) => ({
          ...item,
          images: (item.images || []).filter((src) => src && !src.startsWith("blob:")),
        })),
        swatchesEnabled,
        swatchShape,
        swatchSize,
        purchaseNote,
        menuOrder,
        bundleEnabled,
        bundleDiscountPercent: 5,
        deliveryDays,
        deliveryNote,
        customTabs,
        productTabs,
        freeShipping: Boolean(catalog.freeShipping),
        focusKeyword,
        brand: brand.trim(),
        virtual,
        downloadable,
        taxStatus,
        taxClass,
        badge: badge.trim(),
        tags,
        redirectFallback,
        redirectUrl: redirectUrl.trim(),
        robotsIndex,
        robotsNoFollow,
        socialTitle: socialTitle.trim(),
        socialDescription: socialDescription.trim(),
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
  const stockPreview = catalogLabel(stockStatus, quantity);
  const variationAttributes = attributes.filter((item) => item.forVariations && item.name.trim() && parseValues(item.valuesText).length);

  function openPreview() {
    const pendingImages = [mainImage, ...gallery, ...variations.flatMap((item) => item.images || [])].some((src) => src.startsWith("blob:"));
    if (uploadBusy || pendingImages) {
      setError("Wait for the images to finish uploading, then open the preview.");
      return;
    }
    const visibleImages = [mainImage, ...gallery].filter(Boolean);
    const category = categoryOptions.find((item) => item.id === categoryId);
    const enabled = variations.filter((item) => item.enabled);
    const prices = enabled.map((item) => Number(item.salePrice || item.regularPrice || 0)).filter((value) => value > 0);
    const regular = productType === "variable" ? Math.min(...(prices.length ? prices : [Number(regularPrice || 0)])) : Number(regularPrice || 0);
    const sale = salePrice ? Number(salePrice) : null;
    const current = sale && sale > 0 && regular > 0 && sale < regular ? sale : regular || 0;
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
      onSale: Boolean(sale && sale > 0 && regular > sale),
      discountPercent: sale && sale > 0 && regular > sale ? Math.round(((regular - sale) / regular) * 100) : 0,
      stockStatus: stockStatus === "outofstock" ? "outofstock" : "instock",
      stockQuantity: quantity,
      featured: false,
      image: visibleImages[0],
      images: visibleImages.map((src) => ({ src, alt: title || "Product image" })),
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
        stock: stockFrom(item.stockStatus, item.quantity, item.trackStock),
        stockStatus: item.stockStatus,
        imageUrl: item.images?.[0] || null,
        images: item.images || [],
        weight: item.weight,
        length: item.length,
        width: item.width,
        height: item.height,
        shippingClass: item.shippingClass,
        downloadable: item.downloadable,
        virtual: item.virtual,
        enabled: item.enabled,
        active: true,
      })),
      bundleEnabled,
      bundleDiscountPercent: 5,
      buyTwoDiscountPercent: 5,
      badges: badgesFromCatalog({ badge, tags }),
      tags,
      reviews: [],
      seoTitle: seoTitle || title,
      seoDescription,
      canonicalUrl,
      catalogMeta: {
        productType,
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
    sessionStorage.setItem("zelvomart-product-preview", JSON.stringify(preview));
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
                <a href={`/product/${slug || "product"}/`} target="_blank" rel="noreferrer">
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
                <label className="wp-check-label" style={{ marginLeft: 8 }}>
                  <input type="checkbox" checked={virtual} onChange={(e) => setVirtual(e.target.checked)} />
                  <span>Virtual</span>
                </label>
                <label className="wp-check-label" style={{ marginLeft: 4 }}>
                  <input type="checkbox" checked={downloadable} onChange={(e) => setDownloadable(e.target.checked)} />
                  <span>Downloadable</span>
                </label>
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
                        <label>Regular price (Rs) (ex. tax)</label>
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
                        <label>Sale price (Rs) (ex. tax)</label>
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
                      <div className="wp-form-row">
                        <label>Tax status</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select value={taxStatus} onChange={(e) => setTaxStatus(e.target.value)}>
                            <option value="taxable">Taxable</option>
                            <option value="shipping">Shipping only</option>
                            <option value="none">None</option>
                          </select>
                          <span className="wp-help-icon" title="Define whether or not the product is taxable.">?</span>
                        </div>
                      </div>
                      <div className="wp-form-row">
                        <label>Tax class</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select value={taxClass} onChange={(e) => setTaxClass(e.target.value)}>
                            <option value="standard">Standard</option>
                            <option value="reduced-rate">Reduced rate</option>
                            <option value="zero-rate">Zero rate</option>
                          </select>
                          <span className="wp-help-icon" title="Choose a tax class for this product.">?</span>
                        </div>
                      </div>
                    </>
                  ) : null}

              {activeTab === "inventory" ? (
                <>
                  {productType === "variable" ? (
                    <p className="pd-note">These stock settings apply to the product. Each variation below can keep its own quantity, and that quantity is what the catalog uses.</p>
                  ) : null}
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
                  <Field label="Stock management">
                    <label className="pd-check">
                      <input type="checkbox" checked={trackStock} onChange={(event) => setTrackStock(event.target.checked)} />
                      Track stock quantity for this product
                    </label>
                  </Field>
                  {trackStock ? (
                    <Field label="Quantity">
                      <input type="number" min="0" value={quantity} onChange={(event) => changeQuantity(Number(event.target.value))} />
                    </Field>
                  ) : null}
                  <Field label="Stock status">
                    <div className="pd-radios">
                      {[
                        ["instock", "In stock"],
                        ["outofstock", "Out of stock"],
                        ["onbackorder", "On backorder"],
                      ].map(([value, label]) => (
                        <label key={value}>
                          <input type="radio" name="stockStatus" checked={stockStatus === value} onChange={() => changeStockStatus(value as StockStatus)} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <p className={`pd-stock-result ${stockPreview === "Out of stock" ? "is-out" : "is-in"}`}>
                      Catalog will show <strong>{stockPreview}</strong>
                      {trackStock ? ` · ${quantity} in quantity` : ""}.
                    </p>
                  </Field>
                </>
              ) : null}

              {activeTab === "shipping" ? (
                <>
                  <Field label="Weight (lbs)">
                    <input type="number" min="0" step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} />
                  </Field>
                  <Field label="Dimensions (in)">
                    <div className="pd-dims">
                      <input value={length} onChange={(event) => setLength(event.target.value)} placeholder="Length" aria-label="Length" />
                      <input value={width} onChange={(event) => setWidth(event.target.value)} placeholder="Width" aria-label="Width" />
                      <input value={height} onChange={(event) => setHeight(event.target.value)} placeholder="Height" aria-label="Height" />
                    </div>
                  </Field>
                  <Field label="Shipping class">
                    <select value={shippingClass} onChange={(event) => setShippingClass(event.target.value)}>
                      <option value="">No shipping class</option>
                      <option value="shipping-charges">Shipping Charges</option>
                    </select>
                  </Field>
                </>
              ) : null}

              {activeTab === "linked" ? (
                <div className="pd-stack">
                  <Field label="Upsells">
                    <input placeholder="Search for a product…" readOnly style={{ background: "#f6f7f7" }} />
                  </Field>
                  <Field label="Cross-sells">
                    <input placeholder="Search for a product…" readOnly style={{ background: "#f6f7f7" }} />
                  </Field>
                </div>
              ) : null}

              {activeTab === "attributes" ? (
                <div className="pd-attr">
                  <p className="pd-note">Add details customers can choose, such as Color or Size. Separate each value with a | character.</p>
                  <button
                    type="button"
                    className="admin-btn admin-btn-light"
                    onClick={() =>
                      setAttributes((current) => [
                        ...current,
                        { id: uid("attr"), name: "", valuesText: "", visible: true, forVariations: true, open: true },
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
                          <label className="pd-check">
                            <input
                              type="checkbox"
                              checked={attribute.forVariations}
                              onChange={(event) => updateAttribute(attribute.id, { forVariations: event.target.checked })}
                            />
                            Used for variations
                          </label>
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

              {activeTab === "variations" ? (
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
                          <div className="pd-var-row">
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
                            </div>
                            <div className="pd-var-actions">
                              <button type="button" className={variation.open ? "is-on" : ""} onClick={() => updateVariation(variation.key, { open: !variation.open })}>
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
                                  <input type="checkbox" checked={variation.downloadable} onChange={(event) => updateVariation(variation.key, { downloadable: event.target.checked })} />
                                  Downloadable
                                </label>
                                <label className="pd-check">
                                  <input type="checkbox" checked={variation.virtual} onChange={(event) => updateVariation(variation.key, { virtual: event.target.checked })} />
                                  Virtual
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
                              <label className="pd-var-stock-status">
                                Stock status
                                <select
                                  value={variation.stockStatus === "outofstock" ? "outofstock" : "instock"}
                                  onChange={(event) => changeVariationStatus(variation.key, event.target.value as StockStatus)}
                                >
                                  <option value="instock">In stock</option>
                                  <option value="outofstock">Out of stock</option>
                                </select>
                              </label>
                              {variation.trackStock ? (
                                <label>
                                  Quantity
                                  <input type="number" min="0" value={variation.quantity} onChange={(event) => changeVariationQuantity(variation.key, Number(event.target.value))} />
                                </label>
                              ) : null}
                              <div className="pd-variation-grid">
                                <label>
                                  Weight (lbs)
                                  <input type="number" min="0" step="0.01" value={variation.weight} onChange={(event) => updateVariation(variation.key, { weight: event.target.value })} />
                                </label>
                                <label>
                                  Dimensions (L × W × H)
                                  <div className="pd-dims">
                                    <input value={variation.length} onChange={(event) => updateVariation(variation.key, { length: event.target.value })} placeholder="Length" aria-label="Length" />
                                    <input value={variation.width} onChange={(event) => updateVariation(variation.key, { width: event.target.value })} placeholder="Width" aria-label="Width" />
                                    <input value={variation.height} onChange={(event) => updateVariation(variation.key, { height: event.target.value })} placeholder="Height" aria-label="Height" />
                                  </div>
                                </label>
                              </div>
                              <label>
                                Shipping class
                                <select value={variation.shippingClass} onChange={(event) => updateVariation(variation.key, { shippingClass: event.target.value })}>
                                  <option value="">No shipping class</option>
                                  <option value="shipping-charges">Shipping Charges</option>
                                </select>
                              </label>
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

              {activeTab === "advanced" ? (
                <>
                  <Field label="Purchase note">
                    <textarea rows={3} value={purchaseNote} onChange={(event) => setPurchaseNote(event.target.value)} placeholder="Optional note sent with the order" />
                  </Field>
                  <Field label="Menu order">
                    <input type="number" value={menuOrder} onChange={(event) => setMenuOrder(event.target.value)} />
                  </Field>
                  <Field label="Bundle offer">
                    <label className="pd-check">
                      <input type="checkbox" checked={bundleEnabled} onChange={(event) => setBundleEnabled(event.target.checked)} />
                      Enable buy-2 bundle
                    </label>
                    <p className="pd-side-hint">Buy 2 charges the pair price with 5% off: price × 2 × 0.95.</p>
                  </Field>
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
                    return (
                      <div className="pd-subcard" key={tab.key}>
                        <div className="pd-card-head">
                          <h2>{global.title}</h2>
                          <p>{current.override ? "This product shows the custom text below." : "This product currently shows the store-wide text."}</p>
                        </div>
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
                  {(["general", "advanced", "social", "schema"] as SeoTab[]).map((tab) => (
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
                    <SeoGroup title="Basic SEO" meta={seo.groups.basic} open={seoOpen.basic} onToggle={() => setSeoOpen((current) => ({ ...current, basic: !current.basic }))}>
                      <Check ok={seo.checks.keywordInTitle} text="Add Focus Keyword to the SEO title." />
                      <Check ok={seo.checks.keywordInDescription} text="Add Focus Keyword to your SEO meta description." />
                      <Check ok={seo.checks.keywordInUrl} text="Use Focus Keyword in the product URL / permalink." />
                      <Check ok={seo.checks.keywordAtStart} text="Use Focus Keyword at the beginning of your content." />
                      <Check ok={seo.checks.keywordInContent} text="Use Focus Keyword inside the product description." />
                      <Check ok={seo.checks.contentLength} text={`Content should be 600–2500 words long (Currently ${seo.words} words).`} />
                    </SeoGroup>

                    <SeoGroup title="Additional SEO" meta={seo.groups.additional} open={seoOpen.additional} onToggle={() => setSeoOpen((current) => ({ ...current, additional: !current.additional }))}>
                      <Check ok={seo.checks.keywordInSubheading} text="Use Focus Keyword in a subheading (H2, H3, or H4)." />
                      <Check ok={seo.checks.imageAlt} text="Use Focus Keyword in product image ALT attribute." />
                      <Check ok={seo.checks.density} text={`Keyword density is ${seo.density.toFixed(2)}% (Optimal: ~1.0%).`} />
                      <Check ok={seo.checks.urlLength} text={seo.checks.urlLength ? "URL length looks good (under 75 characters)." : "Keep the URL shorter than 75 characters."} />
                      <Check ok={seo.checks.externalLinks} text="Add external links pointing to helpful resources." />
                      <Check ok={seo.checks.dofollow} text="Add at least one DoFollow external link." />
                      <Check ok={seo.checks.internalLinks} text="Add internal links pointing to related products/categories." />
                      <Check ok={seo.checks.hasKeyword} text="Focus Keyword is configured for this product." />
                    </SeoGroup>

                    <SeoGroup title="Title Readability" meta={seo.groups.title} open={seoOpen.title} onToggle={() => setSeoOpen((current) => ({ ...current, title: !current.title }))}>
                      <Check ok={seo.checks.keywordNearTitleStart} text="Focus Keyword appears near the beginning of the SEO title." />
                      <Check ok={seo.checks.sentiment} text="Title contains a positive or enticing sentiment word." />
                      <Check ok={seo.checks.power} text="Title contains a high-converting power word." />
                      <Check ok={seo.checks.numberInTitle} text="Title contains a number (e.g. pack count or discount %)." />
                    </SeoGroup>

                    <SeoGroup title="Content Readability" meta={seo.groups.content} open={seoOpen.content} onToggle={() => setSeoOpen((current) => ({ ...current, content: !current.content }))}>
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
                      <label>301 Redirect URL</label>
                      <div style={{ width: "100%" }}>
                        <input
                          style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13 }}
                          value={redirectUrl}
                          onChange={(e) => setRedirectUrl(e.target.value)}
                          placeholder="https://zelvomart.com/product/replacement-item/"
                        />
                        <small style={{ fontSize: 11, color: "var(--adm-text-muted)", display: "block", marginTop: 4 }}>
                          If this product is retired or replaced, paste the replacement URL to redirect visitors.
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

                {/* 3. SOCIAL TAB */}
                {seoTab === "social" ? (
                  <div style={{ display: "grid", gap: 20 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--adm-text-muted)" }}>
                      Customize how this product appears when shared on WhatsApp, Facebook, LinkedIn, or Twitter.
                    </p>

                    {/* Social Preview Card */}
                    <div className="rankmath-social-card">
                      {mainImage ? (
                        <img src={mainImage} alt="Social preview" className="rankmath-social-img" />
                      ) : (
                        <div className="rankmath-social-img">
                          <span style={{ color: "var(--adm-text-muted)", fontSize: 13 }}>No product image selected</span>
                        </div>
                      )}
                      <div className="rankmath-social-body">
                        <div className="rankmath-social-domain">ZELVOMART.COM</div>
                        <div className="rankmath-social-title">{socialTitle || seoTitle || title || "Product Title"}</div>
                        <p className="rankmath-social-desc">
                          {socialDescription || seoDescription || plainText(shortHtml) || "Discover premium products on Zelvomart with fast delivery across Pakistan."}
                        </p>
                      </div>
                    </div>

                    <div className="wp-form-row">
                      <label>Social Title</label>
                      <input
                        style={{ width: "100%", height: 38, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13 }}
                        value={socialTitle}
                        onChange={(e) => setSocialTitle(e.target.value)}
                        placeholder={seoTitle || title || "Custom social title"}
                      />
                    </div>

                    <div className="wp-form-row">
                      <label>Social Description</label>
                      <textarea
                        rows={3}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--adm-border)", fontSize: 13, resize: "vertical" }}
                        value={socialDescription}
                        onChange={(e) => setSocialDescription(e.target.value)}
                        placeholder={seoDescription || "Custom social description"}
                      />
                    </div>
                  </div>
                ) : null}

                {/* 4. SCHEMA TAB */}
                {seoTab === "schema" ? (
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-main)" }}>Product Schema (JSON-LD)</span>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#ecfdf5", color: "#059669", fontWeight: 700 }}>Valid Schema</span>
                    </div>
                    <pre style={{ margin: 0, padding: 14, borderRadius: 10, background: "#0b1a2e", color: "#93c5fd", fontSize: 12, lineHeight: 1.6, overflowX: "auto" }}>
                      {JSON.stringify(
                        {
                          "@context": "https://schema.org",
                          "@type": "Product",
                          name: title || "Product Name",
                          image: mainImage ? [mainImage, ...gallery] : [],
                          description: seoDescription || plainText(shortHtml) || "",
                          sku: sku || "ZVM-0001",
                          offers: {
                            "@type": "Offer",
                            price: Number(regularPrice || 0) || 0,
                            priceCurrency: "PKR",
                            availability: stockStatus === "instock" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                            url: previewUrl,
                          },
                        },
                        null,
                        2,
                      )}
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

          {/* 4. Product brands */}
          <div className="wp-metabox">
            <div className="wp-metabox-header" onClick={() => toggleCollapse("brands")}>
              <h3 className="wp-metabox-title">Product brands</h3>
              <span className="wp-metabox-toggle">{collapsed.brands ? "▾" : "▴"}</span>
            </div>
            {!collapsed.brands ? (
              <div className="wp-metabox-body">
                <div className="wp-tabs">
                  <button
                    type="button"
                    className={`wp-tab-btn ${brandTab === "all" ? "is-active" : ""}`}
                    onClick={() => setBrandTab("all")}
                  >
                    All Brands
                  </button>
                  <button
                    type="button"
                    className={`wp-tab-btn ${brandTab === "mostUsed" ? "is-active" : ""}`}
                    onClick={() => setBrandTab("mostUsed")}
                  >
                    Most Used
                  </button>
                </div>
                <div className="wp-scroll-checklist">
                  {brandList.map((item) => (
                    <label key={item} className="wp-check-label">
                      <input
                        type="checkbox"
                        checked={brand === item}
                        onChange={() => setBrand((current: string) => (current === item ? "" : item))}
                      />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                {!showAddBrand ? (
                  <button
                    type="button"
                    className="wp-link-action"
                    onClick={() => setShowAddBrand(true)}
                  >
                    + Add New Brand
                  </button>
                ) : (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input
                      value={newBrandInput}
                      onChange={(e) => setNewBrandInput(e.target.value)}
                      placeholder="New brand name"
                      style={{
                        padding: "4px 8px",
                        border: "1px solid #8c8f94",
                        borderRadius: 3,
                        fontSize: 13,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addBrand();
                        }
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={addBrand}
                        disabled={!newBrandInput.trim()}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        className="wp-btn-secondary"
                        onClick={() => {
                          setShowAddBrand(false);
                          setNewBrandInput("");
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

          {/* 5. Product tags & badges */}
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
              <a href={`/product/${slug || "product"}/`} target="_blank" rel="noreferrer">{previewUrl}</a>
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
              Title
              <input value={imageMeta.title} onChange={(event) => setImageMeta((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label>
              Image caption
              <textarea rows={2} value={imageMeta.caption} onChange={(event) => setImageMeta((current) => ({ ...current, caption: event.target.value }))} />
            </label>
            <label>
              Description
              <textarea rows={2} value={imageMeta.description} onChange={(event) => setImageMeta((current) => ({ ...current, description: event.target.value }))} />
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
              <label className="pd-check">
                <input
                  type="checkbox"
                  checked={imageMeta.excludeFromSitemap}
                  onChange={(event) => setImageMeta((current) => ({ ...current, excludeFromSitemap: event.target.checked }))}
                />
                Exclude this attachment from sitemap
              </label>
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
      <button type="button" className="rankmath-checklist-header" onClick={onToggle}>
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
