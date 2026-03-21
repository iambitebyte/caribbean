export function ShrimpIcon({ className, size = 24, animated = false }: { className?: string; size?: number; animated?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={animated ? "#22c55e" : "#9ca3af"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: size, height: size }}
    >
      {/* Body */}
      <ellipse cx="12" cy="16" rx="8" ry="4" />
      
      {/* Tail segments */}
      <path d="M12 12 L12 4" />
      <path d="M10 12 Q8 10 7 8" />
      <path d="M14 12 Q16 10 17 8" />
      <path d="M9 9 Q7 11 6 10" />
      <path d="M15 9 Q17 11 18 10" />
      
      {/* Head */}
      <circle cx="12" cy="5" r="3" />
      
      {/* Eyes */}
      <circle cx="11" cy="4.5" r="0.5" fill={animated ? "currentColor" : "#9ca3af"} />
      <circle cx="13" cy="4.5" r="0.5" fill={animated ? "currentColor" : "#9ca3af"} />
      
      {/* Antennae */}
      <path d="M10.5 2 L10 0" />
      <path d="M13.5 2 L14 0" />
      
      {/* Legs */}
      <path d="M8 20 L6 23" />
      <path d="M10 20 L9 23" />
      <path d="M14 20 L15 23" />
      <path d="M16 20 L18 23" />
      
      {/* Claws */}
      <path d="M5 16 Q3 17 4 15" />
      <path d="M19 16 Q21 17 20 15" />
    </svg>
  );
}
