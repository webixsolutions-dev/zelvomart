import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHead({
  eyebrow,
  title,
  sub,
  href,
  linkLabel = "View all",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {href && (
        <Link className="pill" href={href}>
          {linkLabel} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
