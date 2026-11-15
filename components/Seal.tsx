/**
 * Round court seal: text running around two rings, a short word in the middle.
 * Pure SVG, so it scales and takes the stamp colour from CSS.
 */
export function Seal({
  center,
  size = 160,
  className,
  title,
}: {
  center: string[];
  size?: number;
  className?: string;
  title?: string;
}) {
  const ring = "Sodišče za vsakdanje spore • Kdo je kriv? • ";
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <path
          id="seal-ring"
          d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"
        />
      </defs>
      <circle
        cx="100"
        cy="100"
        r="94"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
      />
      <circle
        cx="100"
        cy="100"
        r="86"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="100"
        cy="100"
        r="56"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <text
        fontFamily="var(--font-body)"
        fontWeight="600"
        fontSize="14.5"
        letterSpacing="2.2"
        fill="currentColor"
        textLength="452"
        lengthAdjust="spacing"
      >
        <textPath href="#seal-ring" startOffset="0">
          {ring.toUpperCase()}
        </textPath>
      </text>
      {center.map((line, i) => (
        <text
          key={line}
          x="100"
          y={100 + (i - (center.length - 1) / 2) * 24}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--font-body)"
          fontWeight="600"
          fontSize={
            center.length > 1 ? 19 : Math.min(34, 150 / [...line].length)
          }
          letterSpacing={center.length > 1 ? 1.5 : 0}
          fill="currentColor"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}
