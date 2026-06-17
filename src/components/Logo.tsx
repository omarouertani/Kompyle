import React from "react";
import { cn } from "@/lib/utils";

const WORDMARK = "Kompyle";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  /** Tailwind sizing/color classes. Height + text color drive the mark. */
  className?: string;
  /** Accessible label; also used as the SVG title. */
  label?: string;
}

/**
 * Purely typographic wordmark, Anthropic-style serif.
 *
 * Monochrome via `fill-current` -> pass a text color class (e.g. `text-foreground`)
 * so it adapts to light/dark automatically. The viewBox is sized to the glyph
 * metrics below so the mark never clips regardless of the `h-*` class.
 */
export const Logo = React.forwardRef<SVGSVGElement, LogoProps>(function Logo(
  { className = "h-8", label = WORDMARK, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 168 32"
      role="img"
      aria-label={label}
      className={cn("w-auto fill-current", className)}
      {...props}
    >
      <title>{label}</title>
      <text
        x="0"
        y="25"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="26"
        fontWeight={600}
        letterSpacing="-0.03em"
      >
        {WORDMARK}
      </text>
    </svg>
  );
});

export default Logo;
