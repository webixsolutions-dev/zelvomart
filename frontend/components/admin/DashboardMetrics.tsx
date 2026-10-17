import Link from "next/link";

const paths = {
  cart: <><path d="M3 3h2l3 12h11l2-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M10 10h7" /></>,
  revenue: <><circle cx="12" cy="12" r="9" /><path d="M8 7h8M8 10h8M9 7c6 0 6 6 0 6l6 5" /></>,
  truck: <><path d="M3 5h11v13H3zM14 9h4l3 4v5h-7M7 8v5h4" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3" /></>,
  user: <><circle cx="12" cy="7" r="4" /><path d="M3 22v-3a6 6 0 0 1 6-6h6a6 6 0 0 1 6 6v3" /></>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M8 5l9 5" /></>,
  eye: <><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  shield: <><path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5zM9 11l2 2 4-5" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m3 5 9 8 9-8" /></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  document: <><path d="M14 2H5v20h15V8zM14 2v6h6M8 12h8M8 16h6" /></>,
};

export function DashboardIcon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

type MetricProps = { label: string; value?: string | number; detail?: string; icon: keyof typeof paths; color: "blue" | "green" | "purple" | "orange" | "teal" | "pink"; href?: string };

export function MetricCard({ label, value, detail, icon, color, href }: MetricProps) {
  const content = <><span className={`dashboard-metric-icon ${color}`}><DashboardIcon name={icon} /></span><div className="dashboard-metric-copy"><span className="dashboard-metric-label">{label}</span><strong>{value ?? <span className="dashboard-skeleton" aria-label="Loading metric" />}</strong><span className={href ? "dashboard-metric-link" : "dashboard-metric-detail"}>{detail || " "}{href && detail && <span aria-hidden="true"> →</span>}</span></div></>;
  return href ? <Link href={href} className="dashboard-metric">{content}</Link> : <div className="dashboard-metric">{content}</div>;
}

