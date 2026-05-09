type PawMarkProps = {
  className?: string;
  size?: number;
};

/**
 * A simple, gentle paw print mark — sage-colored, inline SVG.
 * One main pad with four toe beans, softly rounded.
 */
export default function PawMark({ className, size = 96 }: PawMarkProps) {
  return (
    <svg
      role="img"
      aria-label="Paw print"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main pad */}
      <path
        d="M50 56c-11 0-19 7.5-19 16.5C31 81 38 86 50 86s19-5 19-13.5C69 63.5 61 56 50 56Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* Top-left toe */}
      <ellipse cx="30" cy="40" rx="7" ry="9.5" fill="currentColor" opacity="0.85" />
      {/* Top-right toe */}
      <ellipse cx="70" cy="40" rx="7" ry="9.5" fill="currentColor" opacity="0.85" />
      {/* Inner-left toe */}
      <ellipse cx="42" cy="26" rx="6" ry="8.5" fill="currentColor" opacity="0.85" />
      {/* Inner-right toe */}
      <ellipse cx="58" cy="26" rx="6" ry="8.5" fill="currentColor" opacity="0.85" />
    </svg>
  );
}
