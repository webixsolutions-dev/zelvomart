import Link from "next/link";
import { money } from "@/lib/format";

type InsightsData = { ordersToday: number; ordersYesterday: number; revenueToday: number; revenueYesterday: number; trackingCoverage: number; emailCoverage: number; acceptedPurchases: number; teamEmails: number };

function Comparison({ label, today, yesterday, currency = false }: { label: string; today: number; yesterday: number; currency?: boolean }) {
  const maximum = Math.max(today, yesterday, 1);
  const format = (value: number) => currency ? money(value) : String(value);
  return <div className="dashboard-comparison"><h3>{label}</h3>{[{ label: "Today", value: today }, { label: "Yesterday", value: yesterday }].map((item, index) => <div className="dashboard-bar-row" key={item.label}><span>{item.label}</span><div className="dashboard-bar-track"><svg viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={`${label}, ${item.label}: ${format(item.value)}`}><rect width={Math.max(0, item.value) / maximum * 100} height="10" rx="2" fill={index === 0 ? "#246bfe" : "#a9c8ff"} /></svg></div><strong>{format(item.value)}</strong></div>)}{today === 0 && yesterday === 0 && <small>No activity recorded for these days.</small>}</div>;
}

function Coverage({ label, value, count, href, color }: { label: string; value: number; count: string; href: string; color: string }) {
  const percent = Number(value || 0);
  return <Link className="dashboard-health-item" href={href}><svg className="dashboard-health-ring" viewBox="0 0 44 44" role="img" aria-label={`${label}: ${percent.toFixed(1)} percent`}><circle cx="22" cy="22" r="18" fill="none" stroke="#edf2fa" strokeWidth="4" /><circle cx="22" cy="22" r="18" fill="none" stroke={color} strokeWidth="4" strokeDasharray={`${Math.min(100, Math.max(0, percent)) * 1.131} 113.1`} transform="rotate(-90 22 22)" strokeLinecap="round" /></svg><div><span>{label}</span><strong>{percent.toFixed(1)}%</strong><small>{count}</small></div><span aria-hidden="true">↗</span></Link>;
}

export default function DashboardInsights({ data }: { data: InsightsData | null }) {
  return <section className="dashboard-insights" aria-labelledby="dashboard-insights-heading"><div className="dashboard-insights-title"><div><span className="dashboard-eyebrow">AT A GLANCE</span><h2 id="dashboard-insights-heading">Store performance</h2></div><Link href="/admin/reports">View reports →</Link></div>{data ? <div className="dashboard-insights-grid"><Comparison label="Orders" today={data.ordersToday} yesterday={data.ordersYesterday} /><Comparison label="Revenue" today={data.revenueToday} yesterday={data.revenueYesterday} currency /><div className="dashboard-health"><h3>Tracking & delivery coverage</h3><Coverage label="Meta Purchase coverage" value={data.trackingCoverage} count={`${data.acceptedPurchases || 0} accepted server events`} href="/admin/tracking" color="#08a680" /><Coverage label="Order email coverage" value={data.emailCoverage} count={`${data.teamEmails || 0} team emails sent`} href="/admin/jobs" color="#8854ed" />{!data.acceptedPurchases && !data.teamEmails && <small>No purchase or email events recorded yet.</small>}</div></div> : <p role="status">Loading performance…</p>}</section>;
}

