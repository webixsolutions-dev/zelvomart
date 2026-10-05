import Image from "next/image";
import Link from "next/link";

export default function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-logo mock-brand-logo ${compact ? "brand-logo--compact" : ""}`}
      aria-label="Zelvomart home"
    >
      <Image
        src="/images/zelvomart-logo.png"
        alt="Zelvomart"
        width={357}
        height={235}
        className="brand-logo-image"
        sizes={compact ? "84px" : "112px"}
      />
    </Link>
  );
}
