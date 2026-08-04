/* eslint-disable @next/next/no-img-element */

/**
 * An image we stored ourselves.
 *
 * next/image is skipped deliberately: these files are served from our own
 * route, already sized for their slot, and given an immutable cache header,
 * so the optimiser would add a hop without adding anything. Keeping the one
 * lint exception here means no other file needs it.
 */
export function UploadedImage({
  src,
  className,
  alt = '',
  width,
  height,
}: {
  src: string;
  className?: string;
  alt?: string;
  width?: number;
  height?: number;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={width || height ? { width, height } : undefined}
    />
  );
}
