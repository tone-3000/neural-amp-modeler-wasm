import React from 'react';

type CircularLoaderProps = {
  size?: number;
  color?: string;
};

export const CircularLoader: React.FC<CircularLoaderProps> = ({
  size = 40,
  color = 'var(--t3k-on-accent)',
}) => {
  // A ring half as wide as the disc with a 3px stroke at 40px (the sizes it
  // was drawn for are unchanged), and in proportion below that: at 24px a
  // fixed 20px margin and 3px stroke left a dot.
  const circleSize = Math.max(size - 20, size / 2);
  const strokeWidth = Math.min(3, (size * 3) / 40);
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className='flex items-center justify-center animate-spin bg-accent rounded-full'
      style={{ width: size, height: size }}
    >
      <svg
        width={circleSize}
        height={circleSize}
        viewBox={`0 0 ${circleSize} ${circleSize}`}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={circleSize / 2}
          cy={circleSize / 2}
          r={radius}
          fill='none'
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.75}
        />
      </svg>
    </div>
  );
};

export default CircularLoader;
