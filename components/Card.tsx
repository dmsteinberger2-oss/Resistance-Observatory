import type { HTMLAttributes, ReactNode } from "react";

type CardProps = {
  as?: "div" | "article" | "section" | "li" | "aside";
  tone?: "default" | "drug" | "signal" | "gap";
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

const TONES = {
  default: "border-line bg-[#091826]/90",
  drug: "border-drug/35 bg-drug-soft/35",
  signal: "border-signal/35 bg-signal-soft/35",
  gap: "border-gap/35 bg-gap-soft/35",
} as const;

export function Card({
  as: Tag = "div",
  tone = "default",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={`rounded-[var(--radius)] border p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
