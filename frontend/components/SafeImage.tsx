"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

interface SafeImageProps extends Omit<ImageProps, "src"> {
  src?: string | null;
  fallbackSrc?: string;
}

export default function SafeImage({
  src,
  fallbackSrc = "/images/home/home-living.png",
  alt,
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  let cleanSrc = hasError || !src ? fallbackSrc : src;

  try {
    cleanSrc = encodeURI(cleanSrc).replace(/&/g, "%26");
  } catch {
    cleanSrc = fallbackSrc;
  }

  return (
    <Image
      {...rest}
      src={cleanSrc}
      alt={alt || "Product image"}
      onError={() => setHasError(true)}
    />
  );
}