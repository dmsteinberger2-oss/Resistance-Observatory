import type {
  BeforeAfterDiagram,
  Diagram,
  LadderDiagram,
} from "@/content/markers";

/**
 * Original SVG diagrams built from content/markers.ts.
 * All labels are real <text> elements (>= 12px). Colour is never the sole
 * encoding: new vs inherited alterations differ by fill, border style, and a
 * "+" prefix; highlighted rungs carry a "▶ THIS MARKER" callout; residue charge
 * swaps use distinct circle (+) vs dashed square (−) geometry.
 */
export function MarkerDiagram({ diagram }: { diagram: Diagram }) {
  return diagram.kind === "ladder" ? (
    <Ladder d={diagram} />
  ) : (
    <BeforeAfter d={diagram} />
  );
}

const SANS = "var(--font-sans)";
const MONO = "var(--font-mono)";
const CHAR_W = 11.4; // approx px per char at mono fontSize 18

function Ladder({ d }: { d: LadderDiagram }) {
  const W = 1080;
  const rungGap = 128;
  const top = 66;
  const n = d.rungs.length;
  const H = top + 58 + (n - 1) * rungGap + 78;
  const barX = 228;
  const barW = 636;
  const hasCarried = d.rungs.some((r) => r.alterations.some((a) => !a.isNew));
  const effX = barX + barW + 22;

  return (
    <figure>
      <div className="overflow-x-auto rounded-[6px] border border-line bg-[#050d17] p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby="ladder-t ladder-d"
          className="w-full min-w-[740px] xl:min-w-0"
        >
          <title id="ladder-t">{d.title}</title>
          <desc id="ladder-d">
            {d.rungs
              .map(
                (r) =>
                  `${r.name}: ${r.alterations
                    .map((a) => `${a.gene} ${a.codon}`)
                    .join(", ")}${
                    r.residueChange ? ` (${r.residueChange.caption})` : ""
                  }`,
              )
              .join(". ")}
            . Earlier rungs sit lower.
            {d.bracket ? ` ${d.bracket.lines.join(" ")}.` : ""}
          </desc>

          {/* Vertical ladder rails */}
          <line
            x1={barX - 10}
            y1={top - 16}
            x2={barX - 10}
            y2={H - 28}
            stroke="var(--line-strong)"
            strokeWidth="2"
          />
          <line
            x1={barX + barW + 10}
            y1={top - 16}
            x2={barX + barW + 10}
            y2={H - 28}
            stroke="var(--line-strong)"
            strokeWidth="2"
          />

          {/* Upward accumulation axis */}
          <g>
            <line
              x1="36"
              y1={H - 36}
              x2="36"
              y2={top}
              stroke="var(--drug)"
              strokeWidth="2"
            />
            <path d={`M36 ${top - 12} l7 14 h-14 Z`} fill="var(--drug)" />
            <text
              x="0"
              y="0"
              transform={`translate(22 ${(H + top) / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize="14"
              fontFamily={MONO}
              fill="var(--muted)"
              letterSpacing="2.4"
            >
              ACCUMULATES
            </text>
          </g>

          {[...d.rungs].map((rung, idx) => {
            // idx 0 = earliest rung = lowest on screen
            const y = top + 58 + (n - 1 - idx) * rungGap;
            let cx = barX + 16;
            return (
              <g key={rung.name}>
                {/* Rung container */}
                <rect
                  x={barX - 10}
                  y={y - 34}
                  width={barW + 20}
                  height="68"
                  rx="8"
                  fill={rung.highlight ? "#122436" : "#0a1929"}
                  stroke={rung.highlight ? "var(--signal)" : "var(--line-strong)"}
                  strokeWidth={rung.highlight ? 2.5 : 1.25}
                />

                {rung.highlight ? (
                  <text
                    x="64"
                    y={y + 42}
                    fontSize="14"
                    fontWeight="700"
                    fontFamily={MONO}
                    fill="var(--signal)"
                  >
                    ▶ THIS MARKER
                  </text>
                ) : null}

                {/* Step label + codon name */}
                <text
                  x="64"
                  y={y - 5}
                  fontSize="23"
                  fontWeight="700"
                  fontFamily={MONO}
                  fill="var(--fg)"
                >
                  {rung.name}
                </text>
                <text
                  x="64"
                  y={y + 19}
                  fontSize="14"
                  fontFamily={MONO}
                  fill="var(--muted)"
                >
                  RUNG 0{idx + 1} / 0{d.rungs.length}
                </text>

                {/* Alteration chips */}
                {rung.alterations.map((a) => {
                  const label = `${a.isNew ? "+ " : ""}${a.gene} ${a.codon}`;
                  const w = label.length * CHAR_W + 28;
                  const x = cx;
                  cx += w + 12;
                  return (
                    <g key={label}>
                      <rect
                        x={x}
                        y={y - 20}
                        width={w}
                        height="40"
                        rx="6"
                        fill={a.isNew ? "var(--drug)" : "var(--bg)"}
                        stroke={a.isNew ? "var(--drug)" : "var(--line-strong)"}
                        strokeWidth="1.5"
                        strokeDasharray={a.isNew ? undefined : "5 4"}
                      />
                      <text
                        x={x + w / 2}
                        y={y + 6}
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight={a.isNew ? 700 : 500}
                        fontFamily={MONO}
                        fill={a.isNew ? "#061821" : "var(--muted)"}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {/* Schematic residue charge-reversal callout */}
                {rung.residueChange ? (
                  <g fontFamily={SANS}>
                    {(() => {
                      const rc = rung.residueChange;
                      const gy = y + 58;
                      const gx = barX + 26;
                      return (
                        <>
                          <circle
                            cx={gx}
                            cy={gy}
                            r="14"
                            fill="var(--bg)"
                            stroke="var(--fg)"
                            strokeWidth="1.75"
                          />
                          <text
                            x={gx}
                            y={gy + 5}
                            textAnchor="middle"
                            fontSize="15"
                            fontWeight="700"
                            fontFamily={MONO}
                            fill="var(--fg)"
                          >
                            {rc.from.letter}
                          </text>
                          <text
                            x={gx + 17}
                            y={gy - 5}
                            fontSize="16"
                            fontWeight="700"
                            fontFamily={MONO}
                            fill="var(--signal)"
                          >
                            {rc.from.charge}
                          </text>
                          <line
                            x1={gx + 36}
                            y1={gy}
                            x2={gx + 68}
                            y2={gy}
                            stroke="var(--fg)"
                            strokeWidth="1.75"
                          />
                          <path
                            d={`M${gx + 75} ${gy} l-9 -5 v10 Z`}
                            fill="var(--fg)"
                          />
                          <rect
                            x={gx + 86}
                            y={gy - 14}
                            width="28"
                            height="28"
                            rx="4"
                            fill="var(--bg)"
                            stroke="var(--drug)"
                            strokeWidth="1.75"
                            strokeDasharray="4 3"
                          />
                          <text
                            x={gx + 100}
                            y={gy + 5}
                            textAnchor="middle"
                            fontSize="15"
                            fontWeight="700"
                            fontFamily={MONO}
                            fill="var(--fg)"
                          >
                            {rc.to.letter}
                          </text>
                          <text
                            x={gx + 118}
                            y={gy - 5}
                            fontSize="16"
                            fontWeight="700"
                            fontFamily={MONO}
                            fill="var(--drug)"
                          >
                            {rc.to.charge}
                          </text>
                          <text
                            x={gx + 144}
                            y={gy + 5}
                            fontSize="15"
                            fill="var(--muted)"
                          >
                            {rc.caption}
                          </text>
                        </>
                      );
                    })()}
                  </g>
                ) : null}

                {/* Effect on drug */}
                {rung.effect ? (
                  <text
                    x={cx + 8}
                    y={y + 6}
                    fontSize="17"
                    fontFamily={SANS}
                    fill="var(--fg)"
                  >
                    {rung.effect}
                  </text>
                ) : (
                  <g>
                    <text
                      x={effX}
                      y={y - 4}
                      fontSize="15"
                      fontFamily={SANS}
                      fill="var(--gap)"
                      fontWeight="600"
                    >
                      Effect on drug:
                    </text>
                    <text
                      x={effX}
                      y={y + 16}
                      fontSize="15"
                      fontFamily={SANS}
                      fill="var(--gap)"
                    >
                      pending review
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Named combination bracket */}
          {d.bracket
            ? (() => {
                const yOf = (idx: number) => top + 58 + (n - 1 - idx) * rungGap;
                const yTop = yOf(d.bracket.to) - 34;
                const yBot = yOf(d.bracket.from) + 34;
                const bx = barX + barW + 24;
                const mid = (yTop + yBot) / 2;
                return (
                  <g>
                    <path
                      d={`M${bx} ${yTop} h12 V${yBot} h-12`}
                      fill="none"
                      stroke="var(--signal)"
                      strokeWidth="2"
                    />
                    {d.bracket.lines.map((line, i) => (
                      <text
                        key={line}
                        x={bx + 24}
                        y={mid - (d.bracket!.lines.length - 1) * 10 + i * 21 + 5}
                        fontSize={i === 0 ? 17 : 15}
                        fontWeight={i === 0 ? 700 : 400}
                        fontFamily={i === 1 ? MONO : SANS}
                        fill={i === 0 ? "var(--fg)" : "var(--muted)"}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                );
              })()
            : null}

          {/* Legend */}
          <g
            transform={`translate(${barX} 26)`}
            fontFamily={MONO}
            fontSize="14"
            fill="var(--muted)"
          >
            <rect
              x="0"
              y="-13"
              width="38"
              height="20"
              rx="4"
              fill="var(--drug)"
            />
            <text
              x="19"
              y="2"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#061821"
            >
              +
            </text>
            <text x="48" y="2">
              new at this rung
            </text>
            {hasCarried ? (
              <>
                <rect
                  x="210"
                  y="-13"
                  width="38"
                  height="20"
                  rx="4"
                  fill="var(--bg)"
                  stroke="var(--line-strong)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text x="258" y="2">
                  carried from rung below
                </text>
              </>
            ) : null}
          </g>
        </svg>
      </div>
      <figcaption className="mt-3.5 text-xs leading-relaxed text-muted sm:text-sm">
        {d.caption}
      </figcaption>
    </figure>
  );
}

function BeforeAfter({ d }: { d: BeforeAfterDiagram }) {
  const panel = (x: number, altered: boolean) => {
    const heading = altered ? d.after.heading : d.before.heading;
    const note = altered ? d.after.note : d.before.note;
    const cx = x + 230;
    const cy = 250;
    const drugs = altered
      ? [
          [-150, -60],
          [-170, 40],
          [150, -90],
          [160, 60],
          [-120, 120],
        ]
      : [
          [-62, -30],
          [-58, 34],
          [60, -36],
          [64, 30],
          [0, -68],
        ];
    return (
      <g>
        <rect
          x={x}
          y="20"
          width="460"
          height="440"
          rx="12"
          fill="var(--surface)"
          stroke="var(--line)"
          strokeWidth="1.5"
        />
        <text
          x={x + 28}
          y="64"
          fontSize="24"
          fontWeight="700"
          fontFamily={SANS}
          fill="var(--fg)"
        >
          {altered ? "▲ " : "✓ "}
          {heading}
        </text>
        <text
          x={x + 28}
          y="94"
          fontSize="16"
          fontFamily={SANS}
          fill="var(--muted)"
        >
          {note}
        </text>
        <rect
          x={cx - 70}
          y={cy - 50}
          width="140"
          height="100"
          rx="32"
          fill={altered ? "url(#hatch)" : "var(--surface-2)"}
          stroke="var(--fg)"
          strokeWidth="3"
        />
        <rect
          x={cx - 82}
          y={cy - 62}
          width="164"
          height="124"
          rx="42"
          fill="none"
          stroke="var(--gap)"
          strokeWidth="2"
          strokeDasharray="8 6"
        />
        <text
          x={cx}
          y={cy + 92}
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fontFamily={SANS}
          fill="var(--fg)"
        >
          {d.element}
        </text>
        {altered ? (
          <g>
            <path
              d={`M${cx + 70} ${cy - 70} l14 25 h-28 Z`}
              fill="var(--signal)"
              stroke="var(--fg)"
              strokeWidth="1.5"
            />
            <text
              x={cx + 92}
              y={cy - 48}
              fontSize="18"
              fontWeight="700"
              fontFamily={MONO}
              fill="var(--signal)"
            >
              altered
            </text>
          </g>
        ) : null}
        {drugs.map(([dx, dy], i) => (
          <rect
            key={i}
            x={cx + dx - 10}
            y={cy + dy - 10}
            width="20"
            height="20"
            transform={`rotate(45 ${cx + dx} ${cy + dy})`}
            fill={altered ? "none" : "var(--drug)"}
            stroke="var(--drug)"
            strokeWidth="2.5"
          />
        ))}
        <text
          x={x + 28}
          y="430"
          fontSize="16"
          fontFamily={MONO}
          fill="var(--muted)"
        >
          {altered
            ? "◇ drug effect blunted (schematic)"
            : "◆ drug effect intact (schematic)"}
        </text>
      </g>
    );
  };

  return (
    <figure>
      <div className="overflow-x-auto rounded-[6px] border border-line bg-[#050d17] p-3">
        <svg
          viewBox="0 0 960 480"
          role="img"
          aria-labelledby="ba-t"
          className="w-full min-w-[640px]"
        >
          <title id="ba-t">{d.title}</title>
          <defs>
            <pattern
              id="hatch"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill="var(--signal-soft)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="10"
                stroke="var(--signal)"
                strokeWidth="3"
              />
            </pattern>
          </defs>
          {panel(0, false)}
          {panel(500, true)}
        </svg>
      </div>
      <figcaption className="mt-3.5 text-xs leading-relaxed text-muted sm:text-sm">
        {d.caption}
      </figcaption>
    </figure>
  );
}
