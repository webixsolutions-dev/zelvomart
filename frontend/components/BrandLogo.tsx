import Link from "next/link";

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} aria-label="Zelvomart home">
      <span className="brand-mark"><span className="brand-bag" /></span>
      <span className="brand-word">ZELVO<span>MART</span></span>
    </Link>
  );
}
