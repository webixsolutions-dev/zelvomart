import { getSetting } from "./settings";

const graphVersion = process.env.META_GRAPH_VERSION || "v23.0";

type MetaConfig = {
  pixelId: string;
  adAccountId: string;
  pageId: string;
  instagramAccountId: string;
  accessToken: string;
};

function normalizeAdAccountId(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

export async function getMetaMarketingConfig(): Promise<MetaConfig> {
  const [pixelId, adAccountId, pageId, instagramAccountId, savedToken] = await Promise.all([
    getSetting<string>(
      "tracking.metaPixelId",
      process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || "",
    ),
    getSetting<string>("marketing.meta.adAccountId", process.env.META_AD_ACCOUNT_ID || ""),
    getSetting<string>("marketing.meta.pageId", process.env.META_PAGE_ID || ""),
    getSetting<string>("marketing.meta.instagramAccountId", process.env.META_INSTAGRAM_ACCOUNT_ID || ""),
    getSetting<string>("marketing.meta.accessToken", ""),
  ]);

  return {
    pixelId: String(pixelId || "").trim(),
    adAccountId: normalizeAdAccountId(String(adAccountId || "")),
    pageId: String(pageId || "").trim(),
    instagramAccountId: String(instagramAccountId || "").trim(),
    accessToken: String(savedToken || process.env.META_MARKETING_ACCESS_TOKEN || "").trim(),
  };
}

async function graph(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}?${qs.toString()}`, {
    headers: { accept: "application/json" },
  });
  const body = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
  if (!response.ok || body?.error) {
    throw new Error(body?.error?.message || `Meta API ${response.status}`);
  }
  return body;
}

function actionCount(actions: any[] | undefined, types: string[]) {
  if (!Array.isArray(actions)) return 0;
  return actions.reduce((sum, action) => {
    if (!types.includes(String(action?.action_type || ""))) return sum;
    return sum + Number(action?.value || 0);
  }, 0);
}

export async function testMetaMarketingConnection() {
  const config = await getMetaMarketingConfig();
  if (!config.accessToken) throw new Error("META_ACCESS_TOKEN_REQUIRED");

  const result: any = {
    configured: true,
    pixelId: config.pixelId,
    adAccountId: config.adAccountId,
    pageId: config.pageId,
    instagramAccountId: config.instagramAccountId,
    adAccount: null,
    facebookPage: null,
    instagram: null,
  };

  if (config.adAccountId) {
    result.adAccount = await graph(config.adAccountId, config.accessToken, {
      fields: "id,name,account_status,currency,timezone_name",
    });
  }
  if (config.pageId) {
    result.facebookPage = await graph(config.pageId, config.accessToken, { fields: "id,name" });
  }
  if (config.instagramAccountId) {
    result.instagram = await graph(config.instagramAccountId, config.accessToken, { fields: "id,username,name" });
  }

  return result;
}

export async function fetchMetaAds(range?: { from: string; to: string }) {
  const config = await getMetaMarketingConfig();
  if (!config.accessToken || !config.adAccountId) {
    return { configured: false, ads: [], currency: null, adAccountName: null };
  }

  const [account, adsResponse, insightsResponse] = await Promise.all([
    graph(config.adAccountId, config.accessToken, {
      fields: "id,name,account_status,currency,timezone_name",
    }),
    graph(`${config.adAccountId}/ads`, config.accessToken, {
      fields: "id,name,status,effective_status,campaign{id,name},adset{id,name}",
      limit: "100",
    }),
    graph(`${config.adAccountId}/insights`, config.accessToken, {
      level: "ad",
      ...(range ? { time_range: JSON.stringify({ since: range.from, until: range.to }) } : { date_preset: "last_30d" }),
      fields: "ad_id,ad_name,campaign_name,adset_name,spend,impressions,reach,clicks,cpc,ctr,actions",
      limit: "500",
    }),
  ]);

  const insightByAd = new Map<string, any>();
  for (const row of insightsResponse?.data || []) insightByAd.set(String(row.ad_id), row);

  const ads = (adsResponse?.data || []).map((ad: any) => {
    const insight = insightByAd.get(String(ad.id)) || {};
    return {
      id: ad.id,
      name: ad.name,
      status: ad.status,
      effectiveStatus: ad.effective_status,
      campaignName: ad.campaign?.name || insight.campaign_name || "",
      adsetName: ad.adset?.name || insight.adset_name || "",
      spend: Number(insight.spend || 0),
      impressions: Number(insight.impressions || 0),
      reach: Number(insight.reach || 0),
      clicks: Number(insight.clicks || 0),
      cpc: Number(insight.cpc || 0),
      ctr: Number(insight.ctr || 0),
      purchases: actionCount(insight.actions, ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]),
      leads: actionCount(insight.actions, [
        "lead",
        "onsite_conversion.lead_grouped",
        "offsite_conversion.fb_pixel_lead",
      ]),
    };
  });

  return {
    configured: true,
    ads,
    currency: account?.currency || null,
    adAccountName: account?.name || null,
  };
}
