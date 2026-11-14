import type { ReactNode } from "react";

type Props = {
  eyebrow?: ReactNode;
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  lede?: ReactNode;
  id?: string;
  className?: string;
};

export function SectionHeading({
  eyebrow,
  children,
  as = "h2",
  lede,
  id,
  className = "",
}: Props) {
  const Tag = as;
  const size =
    as === "h1"
      ? "text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.05]"
      : as === "h2"
        ? "text-[clamp(1.65rem,3vw,2.4rem)] leading-[1.12]"
        : "text-xl sm:text-2xl leading-snug";
  return (
    <div className={`max-w-3xl ${className}`}>
      {eyebrow ? <p className="ro-eyebrow mb-4">{eyebrow}</p> : null}
      <Tag id={id} className={`font-display text-fg text-balance ${size}`}>
        {children}
      </Tag>
      {lede ? (
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-body text-pretty">
          {lede}
        </p>
      ) : null}
    </div>
  );
}
