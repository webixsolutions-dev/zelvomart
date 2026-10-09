import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  priority?: boolean;
  className?: string;
}

export default function BrandLogo({
  priority = false,
  className = "",
}: BrandLogoProps) {
  return (
    <Link href="/" className="brand-logo-link">
      <Image
        src="/images/zelvomart-logo.png"
        alt="Zelvomart"
        width={357}
        height={235}
        sizes="112px"
        className={`brand-logo-image ${className}`.trim()}
        priority={priority}
      />
    </Link>
  );
}