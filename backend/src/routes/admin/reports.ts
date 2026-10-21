import { prisma } from "../../lib/db";
import { requireAuth } from "../../lib/auth";
import { fetchMetaAds, getMetaMarketingConfig } from "../../lib/meta-marketing";
import type { Express } from "express";
import { normalizeTrafficSource } from "../../http/shared";

export function registerAdminReportsRoutes(app: Express) {
  app.get("/api/admin/cro", requireAuth("reports.read"), async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const [orders, eventGroups, abandonedRows] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { total: true, source: true, firstTouch: true, lastTouch: true },
      }),
      prisma.eventLog.groupBy({
        by: ["eventName"],
        where: { createdAt: { gte: since }, channel: "browser" },
        _count: { _all: true },
      }),
      prisma.abandonedCheckout.findMany({ where: { createdAt: { gte: since } }, select: { convertedAt: true } }),
    ]);
    const events = Object.fromEntries(eventGroups.map((e) => [e.eventName, e._count._all]));
    const views = Number(events.ViewContent || 0);
    const addToCart = Number(events.AddToCart || 0);
    const checkout = Number(events.InitiateCheckout || 0);
    const orderCount = orders.length;
    const revenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const rate = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);
    const bySource = new Map<string, { orders: number; revenue: number }>();
    for (const order of orders) {
      const first = (order.firstTouch && typeof order.firstTouch === "object" ? order.firstTouch : {}) as any;
      const last = (order.lastTouch && typeof order.lastTouch === "object" ? order.lastTouch : {}) as any;
      const source = normalizeTrafficSource(order.source || last.utm_source || first.utm_source || "direct");
      const row = bySource.get(source) || { orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      bySource.set(source, row);
    }
    const sources = [...bySource.entries()]
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.orders - a.orders);
    const abandoned = abandonedRows.length;
    const recovered = abandonedRows.filter((row) => row.convertedAt).length;
    const viewToCart = rate(addToCart, views);
    const cartToCheckout = rate(checkout, addToCart);
    const checkoutToOrder = rate(orderCount, checkout);
    const overallConversion = rate(orderCount, views);
    const recoveryRate = rate(recovered, abandoned);
    const opportunities: Array<{ level: string; title: string; detail: string }> = [];
    if (views >= 20 && viewToCart < 8)
      opportunities.push({
        level: "high",
        title: "Product page → cart drop-off",
        detail: `Only ${viewToCart.toFixed(1)}% of product views become Add to Cart. Test stronger above-the-fold CTA, clearer price/offer, delivery promise, reviews and trust proof.`,
      });
    if (addToCart >= 10 && cartToCheckout < 45)
      opportunities.push({
        level: "high",
        title: "Cart → checkout drop-off",
        detail: `${cartToCheckout.toFixed(1)}% of carts reach checkout. Reduce distractions, make delivery/COD terms obvious and keep the checkout CTA visible.`,
      });
    if (checkout >= 10 && checkoutToOrder < 55)
      opportunities.push({
        level: "high",
        title: "Checkout completion is weak",
        detail: `${checkoutToOrder.toFixed(1)}% of initiated checkouts become orders. Review field count, validation errors, mobile form friction and COD confidence messaging.`,
      });
    if (abandoned >= 5 && recoveryRate < 15)
      opportunities.push({
        level: "medium",
        title: "Recover more abandoned checkouts",
        detail: `Recovery is ${recoveryRate.toFixed(1)}%. Prioritize WhatsApp follow-up and measure recovered revenue by source/campaign.`,
      });
    if (orderCount > 0 && sources.length && sources[0].source === "direct")
      opportunities.push({
        level: "medium",
        title: "Improve attribution coverage",
        detail:
          "Direct is the largest order source. Keep UTM parameters on Facebook/Instagram ads and links so CRO decisions can be split by channel and campaign.",
      });
    if (!opportunities.length && views >= 20)
      opportunities.push({
        level: "low",
        title: "Funnel is collecting usable data",
        detail: "Keep testing one variable at a time through Experiments and compare conversion rate, not just clicks.",
      });
    res.json({
      periodDays: 30,
      views,
      addToCart,
      checkout,
      orders: orderCount,
      revenue,
      viewToCart,
      cartToCheckout,
      checkoutToOrder,
      overallConversion,
      abandoned,
      recovered,
      recoveryRate,
      averageOrderValue: orderCount ? revenue / orderCount : 0,
      sources,
      opportunities,
    });
  });

  app.get("/api/admin/reports", requireAuth("reports.read"), async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const [orders, eventGroups, eventRows] = await Promise.all([
      prisma.order.findMany({ where: { createdAt: { gte: since } }, include: { items: true } }),
      prisma.eventLog.groupBy({
        by: ["eventName"],
        where: { createdAt: { gte: since }, channel: "browser" },
        _count: { _all: true },
      }),
      prisma.eventLog.findMany({
        where: { createdAt: { gte: since }, channel: "browser", eventName: { in: ["ViewContent", "AddToCart"] } },
        select: { eventName: true, payload: true },
        take: 10000,
      }),
    ]);
    const products = new Map<
      string,
      { title: string; qty: number; revenue: number; views: number; carts: number; orders: number }
    >();
    const ensure = (sku: string, title = sku) => {
      const row = products.get(sku) || { title, qty: 0, revenue: 0, views: 0, carts: 0, orders: 0 };
      products.set(sku, row);
      return row;
    };
    for (const o of orders) {
      const ordered = new Set<string>();
      for (const i of o.items) {
        const row = ensure(i.sku, i.title);
        row.qty += i.quantity;
        row.revenue += Number(i.lineTotal);
        ordered.add(i.sku);
      }
      for (const sku of ordered) ensure(sku).orders += 1;
    }
    for (const e of eventRows) {
      const payload = (
        e.payload && typeof e.payload === "object" && !Array.isArray(e.payload) ? e.payload : {}
      ) as Record<string, unknown>;
      const params = (
        payload.params && typeof payload.params === "object" && !Array.isArray(payload.params) ? payload.params : {}
      ) as Record<string, unknown>;
      const ids: string[] = Array.isArray(params.content_ids)
        ? params.content_ids.map((id: unknown) => String(id))
        : [];
      for (const sku of new Set<string>(ids)) {
        const row = ensure(sku);
        if (e.eventName === "ViewContent") row.views += 1;
        if (e.eventName === "AddToCart") row.carts += 1;
      }
    }
    const productRows = [...products.entries()]
      .map(([sku, v]) => ({
        sku,
        ...v,
        viewToCart: v.views ? Math.round((v.carts / v.views) * 1000) / 10 : 0,
        orderRate: v.views ? Math.round((v.orders / v.views) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
    res.json({
      orders: orders.length,
      revenue: orders.reduce((s, o) => s + Number(o.total), 0),
      events: Object.fromEntries(eventGroups.map((e) => [e.eventName, e._count._all])),
      products: productRows,
    });
  });
  app.get("/api/admin/marketing", requireAuth("reports.read"), async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        id: true,
        orderNumber: true,
        fullName: true,
        total: true,
        source: true,
        firstTouch: true,
        lastTouch: true,
        createdAt: true,
      },
    });
    const bySource = new Map<string, { orders: number; revenue: number }>();
    for (const order of orders) {
      const last = (
        order.lastTouch && typeof order.lastTouch === "object" && !Array.isArray(order.lastTouch) ? order.lastTouch : {}
      ) as Record<string, unknown>;
      const first = (
        order.firstTouch && typeof order.firstTouch === "object" && !Array.isArray(order.firstTouch)
          ? order.firstTouch
          : {}
      ) as Record<string, unknown>;
      const source = normalizeTrafficSource(order.source || last.utm_source || first.utm_source || "direct");
      const row = bySource.get(source) || { orders: 0, revenue: 0 };
      row.orders += 1;
      row.revenue += Number(order.total);
      bySource.set(source, row);
    }
    const sources = [...bySource.entries()]
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.orders - a.orders);
    const recent = orders.slice(0, 50).map((order) => {
      const last = (
        order.lastTouch && typeof order.lastTouch === "object" && !Array.isArray(order.lastTouch) ? order.lastTouch : {}
      ) as Record<string, unknown>;
      const first = (
        order.firstTouch && typeof order.firstTouch === "object" && !Array.isArray(order.firstTouch)
          ? order.firstTouch
          : {}
      ) as Record<string, unknown>;
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        fullName: order.fullName,
        total: Number(order.total),
        createdAt: order.createdAt,
        source: normalizeTrafficSource(order.source || last.utm_source || first.utm_source || "direct"),
        medium: String(last.utm_medium || first.utm_medium || ""),
        campaign: String(last.utm_campaign || first.utm_campaign || ""),
        content: String(last.utm_content || first.utm_content || ""),
        adId: String(last.ad_id || first.ad_id || ""),
        adsetId: String(last.adset_id || first.adset_id || ""),
        campaignId: String(last.campaign_id || last.utm_id || first.campaign_id || first.utm_id || ""),
      };
    });
    const config = await getMetaMarketingConfig();
    let meta: any = {
      configured: Boolean(config.accessToken && config.adAccountId),
      ads: [],
      currency: null,
      adAccountName: null,
      error: null,
    };
    if (meta.configured) {
      try {
        meta = await fetchMetaAds();
      } catch (error: any) {
        meta = { ...meta, error: error?.message || "META_API_ERROR" };
      }
    }
    res.json({
      periodDays: 30,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
      facebookOrders: sources.find((x) => x.source === "facebook")?.orders || 0,
      instagramOrders: sources.find((x) => x.source === "instagram")?.orders || 0,
      attributedOrders: orders.filter((o) => normalizeTrafficSource(o.source) !== "direct").length,
      sources,
      recent,
      meta: {
        ...meta,
        pixelId: config.pixelId,
        adAccountId: config.adAccountId,
        pageId: config.pageId,
        instagramAccountId: config.instagramAccountId,
        accessTokenConfigured: Boolean(config.accessToken),
      },
    });
  });
}
