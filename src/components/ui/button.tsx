import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "dark";
type Size = "md" | "lg";

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

const variantMap: Record<Variant, string> = {
  primary: "bg-[#0071e3] text-white shadow-md shadow-blue-200",
  secondary: "border border-black/10 bg-white text-[#1d1d1f] shadow-sm",
  dark: "bg-[#1d1d1f] text-white shadow-md"
};

const sizeMap: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base"
};

const base =
  "inline-flex items-center justify-center rounded-full font-semibold transition-transform duration-150 active:scale-[0.98]";

export function AppButton({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
  ...buttonProps
}: {
  href?: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(base, variantMap[variant], sizeMap[size], className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
