export type Product = { id: string; title: string; sku: string };
export type Media = {
  id?: string;
  type: string;
  url?: string;
  path?: string;
  avatar?: boolean;
};
export type Review = {
  id: string;
  productId: string;
  product: Product;
  name: string;
  email?: string;
  rating: number;
  body: string;
  status: string;
  origin: string;
  verified?: boolean;
  reviewRef?: string;
  batchId?: string;
  reviewDate?: string;
  createdAt: string;
  media: Media[];
  avatarUrl?: string;
};
export type Batch = {
  id: string;
  filename: string;
  createdAt: string;
  deletedAt?: string;
  imported: number;
  skipped: number;
  failed: number;
  _count?: { reviews: number };
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(
    new Date(),
  );
export const day = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "—";
export const statusLabel = (value: string) =>
  ({ PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" })[value] ||
  value;
