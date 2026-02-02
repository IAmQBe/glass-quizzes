// Popcorn icon for popularity
export const PopcornIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 9a4 4 0 0 1 8 0c0 .32-.04.63-.1.92" />
    <path d="M9 9a4 4 0 0 1 8 0" />
    <path d="M5 9h14l-1.5 12h-11L5 9Z" />
    <path d="M8 9V7a2 2 0 0 1 4 0" />
    <path d="M12 9V5a2 2 0 0 1 4 0v2" />
    <circle cx="7" cy="6" r="2" />
    <circle cx="12" cy="4" r="2" />
    <circle cx="17" cy="6" r="2" />
  </svg>
);