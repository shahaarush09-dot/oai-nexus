export function PlayIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function PauseIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" />
      <rect x="14" y="5" width="4" height="14" />
    </svg>
  );
}

export function MuteIcon({ muted, className = "h-4 w-4" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
      {muted ? (
        <path d="M17 8l4 8M21 8l-4 8" strokeLinecap="round" />
      ) : (
        <path d="M16 8.5a4 4 0 010 7M18.5 6a7.5 7.5 0 010 12" strokeLinecap="round" />
      )}
    </svg>
  );
}
