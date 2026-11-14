/**
 * Schematic scientific illustration: intraerythrocytic parasite, arriving drug
 * molecules, and cellular outcome. Not to scale and not a protein structure.
 *
 * Accessibility: colour is never the sole encoding — drug molecules are rotated
 * diamonds, the mutation is a triangle glyph with a real <text> callout, a
 * cleared parasite switches to a dashed perimeter + checkmark badge, and a
 * blunted outcome keeps a solid perimeter + warning triangle badge.
 */
type Props = { step: number; mutant: boolean; title: string };

const DRUG_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function ParasiteScene({ step, mutant, title }: Props) {
  const arrived = step >= 1;
  const outcome = step >= 2;
  const cleared = outcome && !mutant;
  const blunted = outcome && mutant;
  const titleId = `parasite-scene-${mutant ? "mut" : "wt"}`;

  return (
    <svg
      viewBox="0 0 420 390"
      role="img"
      aria-labelledby={titleId}
      className="mx-auto w-full max-w-[430px] overflow-visible"
    >
      <title id={titleId}>{title}</title>

      <defs>
        <radialGradient id={`${titleId}-rbc`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#132c42" stopOpacity="0.55" />
          <stop offset="78%" stopColor="#0d2133" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#16364e" stopOpacity="1" />
        </radialGradient>
      </defs>

      {/* Coordinate corner ticks */}
      <g stroke="var(--line-strong)" strokeWidth="1" fill="none">
        <path d="M16 28V16h12M392 16h12v12M16 362v12h12M392 374h12v-12" />
      </g>

      {/* Red blood cell double membrane */}
      <circle
        cx="210"
        cy="192"
        r="142"
        fill={`url(#${titleId}-rbc)`}
        stroke="var(--line-strong)"
        strokeWidth="1.5"
      />
      <circle
        cx="210"
        cy="192"
        r="134"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
      />
      <circle
        cx="210"
        cy="192"
        r="96"
        fill="none"
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="3 6"
      />
      <text
        x="210"
        y="36"
        textAnchor="middle"
        fontSize="13"
        fill="var(--muted)"
        fontFamily="var(--font-mono)"
        letterSpacing="1.2"
      >
        HOST RED BLOOD CELL
      </text>

      {/* Intraerythrocytic parasite */}
      <g
        style={{
          transition: "opacity 700ms ease, transform 700ms ease",
          opacity: cleared ? 0.28 : 1,
          transformOrigin: "210px 192px",
          transform: cleared ? "scale(0.82)" : "none",
        }}
      >
        <circle
          cx="210"
          cy="192"
          r="46"
          fill={mutant ? "#1c1f2b" : "#0b1c2c"}
          stroke="var(--fg)"
          strokeWidth={cleared ? 2.5 : 4.5}
          strokeDasharray={cleared ? "6 6" : undefined}
        />
        <circle
          cx="210"
          cy="192"
          r="34"
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="1"
        />
        {/* Chromatin dot */}
        <circle cx="230" cy="173" r="8.5" fill="var(--fg)" />

        {mutant ? (
          <g>
            <path
              d="M210 132 l11 20 h-22 Z"
              fill="var(--signal)"
              stroke="var(--fg)"
              strokeWidth="1.5"
            />
            <line
              x1="220"
              y1="141"
              x2="272"
              y2="112"
              stroke="var(--signal)"
              strokeWidth="1.5"
            />
            <circle cx="272" cy="112" r="2.5" fill="var(--signal)" />
            <text
              x="280"
              y="116"
              fontSize="13"
              fontWeight="700"
              fill="var(--signal)"
              fontFamily="var(--font-mono)"
            >
              mutation
            </text>
          </g>
        ) : null}
      </g>

      <text
        x="210"
        y="260"
        textAnchor="middle"
        fontSize="13"
        fill="var(--muted)"
        fontFamily="var(--font-sans)"
      >
        P. falciparum parasite
      </text>

      {/* Arriving drug molecules (rotated diamond glyphs) */}
      {DRUG_ANGLES.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const far = 192;
        const near = cleared ? 46 : blunted ? 88 : 62;
        const r = arrived ? near : far;
        const x = 210 + Math.cos(rad) * r;
        const y = 192 + Math.sin(rad) * r;
        return (
          <g
            key={deg}
            style={{
              transition: `transform 850ms cubic-bezier(.2,.7,.2,1) ${i * 35}ms, opacity 450ms`,
              transform: `translate(${x}px, ${y}px)`,
              opacity: arrived ? 1 : 0.5,
            }}
          >
            <rect
              x="-6.5"
              y="-6.5"
              width="13"
              height="13"
              transform="rotate(45)"
              fill={blunted ? "#103238" : "var(--drug)"}
              stroke="var(--drug)"
              strokeWidth="1.5"
            />
          </g>
        );
      })}

      {/* Legend */}
      <g
        transform="translate(28 364)"
        fontFamily="var(--font-mono)"
        fontSize="12"
        fill="var(--muted)"
      >
        <rect
          x="0"
          y="-6"
          width="9"
          height="9"
          transform="rotate(45 4.5 -1.5)"
          fill="var(--drug)"
        />
        <text x="16" y="3">
          drug molecule
        </text>
        {mutant ? (
          <>
            <path d="M132 -6 l5 9 h-10 Z" fill="var(--signal)" />
            <text x="144" y="3">
              tracked alteration
            </text>
          </>
        ) : null}
      </g>

      {/* Outcome status pill */}
      {outcome ? (
        <g fontFamily="var(--font-mono)">
          <rect
            x="102"
            y="292"
            width="216"
            height="32"
            rx="16"
            fill="#06101b"
            stroke={cleared ? "var(--drug)" : "var(--signal)"}
            strokeWidth="1.5"
          />
          <text
            x="210"
            y="312"
            textAnchor="middle"
            fontSize="13"
            fontWeight="600"
            fill={cleared ? "var(--drug)" : "var(--signal)"}
          >
            {cleared ? "✓ parasite cleared" : "▲ drug efficacy reduced"}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
