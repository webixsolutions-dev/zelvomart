"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";

interface SafeImageProps extends Omit<ImageProps, "src"> {
  src?: string | null;
  fallbackSrc?: string;
}

export default function SafeImage({
  src,
  fallbackSrc = "/images/Zelvomart images/home and living zelvomart.png",
  alt,
  ...rest
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  const cleanSrc = hasError || !src ? fallbackSrc : src;

  return (
    <Image
      {...rest}
      src={cleanSrc}
      alt={alt || "Product image"}
      onError={() => setHasError(true)}
    />
  );
}