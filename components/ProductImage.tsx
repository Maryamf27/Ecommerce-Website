"use client";

import Image from "next/image";
import { useState } from "react";

type ProductImageProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
};

export default function ProductImage({ src, alt, sizes, priority = false, className }: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <span className="image-fallback" role="img" aria-label={`${alt} image unavailable`}>Image unavailable</span>;
  }

  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized className={className} onError={() => setFailed(true)} />;
}
