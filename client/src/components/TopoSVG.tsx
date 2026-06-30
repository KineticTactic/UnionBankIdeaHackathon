import { generateTopoContours } from '@/lib/topo';

interface TopoSVGProps {
  width?: number;
  height?: number;
  seed: number;
  levels?: number;
  resolution?: number;
  color: string;
  strokeWidth?: number;
  opacity?: number;
  elevationRange?: [number, number];
  className?: string;
}

export default function TopoSVG({
  width = 1600,
  height = 900,
  seed,
  levels = 12,
  resolution = 16,
  color,
  strokeWidth = 0.6,
  opacity = 0.5,
  elevationRange = [-0.5, 0.5],
  className,
}: TopoSVGProps) {
  const paths = generateTopoContours({
    width,
    height,
    seed,
    levels,
    resolution,
    color,
    strokeWidth,
    opacity,
    elevationRange,
  });

  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <g stroke={color} strokeWidth={strokeWidth} fill="none" opacity={opacity}>
        {paths.map((p, i) => (
          <path key={i} d={p.d} />
        ))}
      </g>
    </svg>
  );
}
