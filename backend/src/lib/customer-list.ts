import { Prisma } from "../generated/prisma/client";
import { prisma } from "./db";

/**
 * Admin → Customers list, paged on the server. Each row is a summary built with SQL aggregates (order count, spend,
 * last order, ...); the full order history is only loaded in the customer details. The segment rules are the ones
 * the Customers screen always used:
 * - New: registered in the selected period (this month, Pakistan time, by default).
 * - Active: not blocked and an order (not cancelled or returned) in the 90 days up to the period end.
 * - Returning: at least 2 orders up to the period end, not counting cancelled or returned ones.
 * - VIP: at least 10 delivered/settled orders, or PKR 50,000 delivered/settled, up to the period end.
 * The stat cards compare with the preceding period of the same length.
 */
export const CUSTOMER_PAGE_SIZES = { default: 10, max: 100, export: 5000 } as const;
export const CUSTOMER_SEGMENTS = ["all", "new", "returning", "vip", "active"] as const;
export const CUSTOMER_SORTS = ["newest", "spent", "orders", "name"] as const;
export const CUSTOMER_STATES = ["all", "blocked", "unblocked"] as const;

export type CustomerListQuery = {
  page: number;
  pageSize: number;
  q: string;
  segment: (typeof CUSTOMER_SEGMENTS)[number];
  sort: (typeof CUSTOMER_SORTS)[number];
  state: (typeof CUSTOMER_STATES)[number];
  city: string;
  /** YYYY-MM-DD in Pakistan time, as typed in the date pickers; empty when not set. */
  from: string;
  to: string;
  exportAll: boolean;
};

const PKT_OFFSET_MS = 5 * 3600_000;
const DAY_MS = 86_400_000;
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const pick = <T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] =>
  (allowed as readonly string[]).includes(String(value)) ? (String(value) as T[number]) : fallback;
const whole = (value: unknown, fallback: number) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
};

/** Reads the list query string; anything unknown or out of range falls back to the default. */
export function parseCustomerListQuery(query: Record<string, unknown>): CustomerListQuery {
  const from = String(query.from || "").trim();
  const to = String(query.to || "").trim();
  return {
    page: whole(query.page, 1),
    pageSize: Math.min(whole(query.pageSize, CUSTOMER_PAGE_SIZES.default), CUSTOMER_PAGE_SIZES.max),
    q: String(query.q || "")
      .trim()
      .slice(0, 100),
    segment: pick(query.segment, CUSTOMER_SEGMENTS, "all"),
    sort: pick(query.sort, CUSTOMER_SORTS, "newest"),
    state: pick(query.state, CUSTOMER_STATES, "all"),
    city: String(query.city || "")
      .trim()
      .slice(0, 100),
    from: isDay(from) ? from : "",
    to: isDay(to) ? to : "",
    exportAll: query.export === "1" || query.export === "true",
  };
}

/** The selected period and the one before it, exactly as the screen computed them in the browser. */
export function customerPeriods(from: string, to: string, now = Date.now()) {
  const pkt = new Date(now + PKT_OFFSET_MS);
  const start = from
    ? Date.parse(`${from}T00:00:00+05:00`)
    : Date.UTC(pkt.getUTCFullYear(), pkt.getUTCMonth(), 1) - PKT_OFFSET_MS;
  const end = to ? Date.parse(`${to}T23:59:59.999+05:00`) : now;
  const previousEnd = start - 1;
  const previousStart = start - Math.max(1, end - start + 1);
  return {
    start: new Date(start),
    end: new Date(end),
    previousStart: new Date(previousStart),
    previousEnd: new Date(previousEnd),
    activeFrom: new Date(end - 90 * DAY_MS),
    previousActiveFrom: new Date(previousEnd - 90 * DAY_MS),
  };
}

// Prisma stores DateTime as UTC in timestamp(3) columns; compare against UTC explicitly.
const at = (date: Date) => Prisma.sql`(CAST(${date.toISOString()} AS timestamptz) AT TIME ZONE 'UTC')`;
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

/** One row per customer: lifetime summary plus the segment flags for the selected and the previous period. */
function summariesSql(p: ReturnType<typeof customerPeriods>) {
  const valid = Prisma.sql`o.status NOT IN ('CANCELLED', 'RETURNED')`;
  const done = Prisma.sql`o.status IN ('DELIVERED', 'SETTLED')`;
  return Prisma.sql`
    WITH agg AS (
      SELECT c.id, c.name, c.phone, c.email, c.notes, c."createdAt", c."updatedAt", c.blocklisted, c."refusalCount",
        count(o.id)::int AS "orderCount",
        coalesce(sum(o.total) FILTER (WHERE ${done}), 0)::float8 AS "totalSpent",
        count(o.id) FILTER (WHERE ${done})::int AS "deliveredCount",
        count(o.id) FILTER (WHERE o.status = 'RETURNED')::int AS "returnedCount",
        max(o."createdAt") AS "lastOrder",
        (array_agg(o.city ORDER BY o."createdAt" DESC) FILTER (WHERE o.id IS NOT NULL))[1] AS city,
        count(o.id) FILTER (WHERE ${valid} AND o."createdAt" <= ${at(p.end)})::int AS "validNow",
        count(o.id) FILTER (WHERE ${done} AND o."createdAt" <= ${at(p.end)})::int AS "doneNow",
        coalesce(sum(o.total) FILTER (WHERE ${done} AND o."createdAt" <= ${at(p.end)}), 0) AS "spentNow",
        coalesce(bool_or(${valid} AND o."createdAt" <= ${at(p.end)} AND o."createdAt" >= ${at(p.activeFrom)}), false) AS "activeNow",
        count(o.id) FILTER (WHERE ${valid} AND o."createdAt" <= ${at(p.previousEnd)})::int AS "validBefore",
        coalesce(bool_or(${valid} AND o."createdAt" <= ${at(p.previousEnd)} AND o."createdAt" >= ${at(p.previousActiveFrom)}), false) AS "activeBefore",
        coalesce(bool_or(o."createdAt" >= ${at(p.start)} AND o."createdAt" <= ${at(p.end)}), false) AS "orderedInPeriod"
      FROM "Customer" c
      LEFT JOIN "Order" o ON o."customerId" = c.id
      GROUP BY c.id
    )
    SELECT agg.*,
      (agg."createdAt" >= ${at(p.start)} AND agg."createdAt" <= ${at(p.end)}) AS "isNew",
      (NOT agg.blocklisted AND agg."activeNow") AS "isActive",
      (agg."validNow" >= 2) AS "isReturning",
      (agg."doneNow" >= 10 OR agg."spentNow" >= 50000) AS "isVip",
      (agg."createdAt" <= ${at(p.end)}) AS "inSnapshot",
      (agg."createdAt" <= ${at(p.previousEnd)}) AS "inPrevious",
      (agg."createdAt" >= ${at(p.previousStart)} AND agg."createdAt" <= ${at(p.previousEnd)}) AS "wasNew",
      (NOT agg.blocklisted AND agg."activeBefore") AS "wasActive",
      (agg."validBefore" >= 2) AS "wasReturning"
    FROM agg`;
}

const SORT_SQL: Record<CustomerListQuery["sort"], Prisma.Sql> = {
  newest: Prisma.sql`s."createdAt" DESC, s."updatedAt" DESC, s.id`,
  spent: Prisma.sql`s."totalSpent" DESC, s."updatedAt" DESC, s.id`,
  orders: Prisma.sql`s."orderCount" DESC, s."updatedAt" DESC, s.id`,
  name: Prisma.sql`lower(coalesce(s.name, s.phone)) ASC, s."updatedAt" DESC, s.id`,
};

type SummaryRow = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  blocklisted: boolean;
  refusalCount: number;
  orderCount: number;
  totalSpent: number;
  deliveredCount: number;
  returnedCount: number;
  lastOrder: Date | null;
  city: string | null;
  isNew: boolean;
  isActive: boolean;
  isReturning: boolean;
  isVip: boolean;
};

/** The customer fields the list sends (no order history; that is in GET /api/admin/customers/:id). */
const publicRow = (r: SummaryRow) => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  email: r.email,
  notes: r.notes,
  city: r.city,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  blocklisted: r.blocklisted,
  refusalCount: r.refusalCount,
  orderCount: r.orderCount,
  totalSpent: Number(r.totalSpent),
  deliveredCount: r.deliveredCount,
  returnedCount: r.returnedCount,
  lastOrder: r.lastOrder,
  segments: { new: r.isNew, active: r.isActive, returning: r.isReturning, vip: r.isVip },
});

export async function listCustomers(query: CustomerListQuery, now = Date.now()) {
  const periods = customerPeriods(query.from, query.to, now);
  const base = summariesSql(periods);
  const filters: Prisma.Sql[] = [];
  if (query.segment !== "all") {
    const flag = { new: "isNew", returning: "isReturning", vip: "isVip", active: "isActive" }[query.segment];
    filters.push(Prisma.sql`s.${Prisma.raw(`"${flag}"`)}`);
  }
  if (query.state === "blocked") filters.push(Prisma.sql`s.blocklisted`);
  if (query.state === "unblocked") filters.push(Prisma.sql`NOT s.blocklisted`);
  if (query.city) filters.push(Prisma.sql`s.city = ${query.city}`);
  if (query.from || query.to)
    filters.push(
      Prisma.sql`((s."createdAt" >= ${at(periods.start)} AND s."createdAt" <= ${at(periods.end)}) OR s."orderedInPeriod")`,
    );
  if (query.q) {
    const like = `%${escapeLike(query.q)}%`;
    filters.push(
      Prisma.sql`(coalesce(s.name, '') ILIKE ${like} OR s.phone ILIKE ${like} OR coalesce(s.email, '') ILIKE ${like} OR coalesce(s.city, '') ILIKE ${like})`,
    );
  }
  const where = filters.length ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;

  const [{ total }] = await prisma.$queryRaw<{ total: number }[]>`
    SELECT count(*)::int AS total FROM (${base}) s ${where}`;
  const pageSize = query.exportAll ? CUSTOMER_PAGE_SIZES.export : query.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = query.exportAll ? 1 : Math.min(query.page, totalPages);
  const rows = await prisma.$queryRaw<SummaryRow[]>`
    SELECT * FROM (${base}) s ${where}
    ORDER BY ${SORT_SQL[query.sort]}
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
  const items = rows.map(publicRow);
  if (query.exportAll) return { items, total, page, pageSize, totalPages };

  // Stat cards, tabs, segment chart, cities, top customers and recent activity: always the whole store.
  const [stats] = await prisma.$queryRaw<Record<string, number>[]>`
    SELECT
      count(*) FILTER (WHERE s."inSnapshot")::int AS "all",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isNew")::int AS "new",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isActive")::int AS "active",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isReturning")::int AS "returning",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isVip")::int AS "vip",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isReturning" AND NOT s."isVip")::int AS "segReturning",
      count(*) FILTER (WHERE s."inSnapshot" AND s."isNew" AND NOT s."isVip" AND NOT s."isReturning")::int AS "segNew",
      count(*) FILTER (WHERE s."inSnapshot" AND NOT s."isNew" AND NOT s."isVip" AND NOT s."isReturning")::int AS "segOther",
      count(*) FILTER (WHERE s."inPrevious")::int AS "prevAll",
      count(*) FILTER (WHERE s."inPrevious" AND s."wasNew")::int AS "prevNew",
      count(*) FILTER (WHERE s."inPrevious" AND s."wasActive")::int AS "prevActive",
      count(*) FILTER (WHERE s."inPrevious" AND s."wasReturning")::int AS "prevReturning"
    FROM (${base}) s`;
  const [cities, top, activity] = await Promise.all([
    prisma.$queryRaw<{ city: string }[]>`
      SELECT DISTINCT s.city FROM (${base}) s WHERE s.city IS NOT NULL AND s.city <> '' ORDER BY s.city`,
    prisma.$queryRaw<SummaryRow[]>`
      SELECT * FROM (${base}) s WHERE s."inSnapshot" AND s."totalSpent" > 0
      ORDER BY s."totalSpent" DESC, s."updatedAt" DESC, s.id LIMIT 5`,
    prisma.$queryRaw<
      {
        id: string;
        kind: "registered" | "order";
        createdAt: Date;
        orderId: string | null;
        orderNumber: string | null;
        customerId: string;
        name: string | null;
        phone: string;
      }[]
    >`
      SELECT * FROM (
        SELECT 'new-' || c.id AS id, 'registered' AS kind, c."createdAt", NULL AS "orderId", NULL AS "orderNumber",
          c.id AS "customerId", c.name, c.phone
        FROM "Customer" c
        WHERE c."createdAt" >= ${at(periods.start)} AND c."createdAt" <= ${at(periods.end)}
        UNION ALL
        SELECT o.id, 'order' AS kind, o."createdAt", o.id AS "orderId", o."orderNumber",
          c.id AS "customerId", c.name, c.phone
        FROM "Order" o JOIN "Customer" c ON c.id = o."customerId"
        WHERE c."createdAt" <= ${at(periods.end)}
          AND o."createdAt" >= ${at(periods.start)} AND o."createdAt" <= ${at(periods.end)}
      ) a
      ORDER BY a."createdAt" DESC LIMIT 6`,
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    counts: { all: stats.all, new: stats.new, active: stats.active, returning: stats.returning, vip: stats.vip },
    previousCounts: {
      all: stats.prevAll,
      new: stats.prevNew,
      active: stats.prevActive,
      returning: stats.prevReturning,
    },
    segments: { vip: stats.vip, returning: stats.segReturning, new: stats.segNew, other: stats.segOther },
    cities: cities.map((c) => c.city),
    top: top.map(publicRow),
    activity,
  };
}
