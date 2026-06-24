export function RenderQueueIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28,28H4a2.0021,2.0021,0,0,1-2-2V21H4v5H28V21h2v5A2.0021,2.0021,0,0,1,28,28Z" />
      <rect x="7" y="21" width="18" height="2" />
      <rect x="7" y="16" width="18" height="2" />
      <rect x="7" y="11" width="18" height="2" />
      <rect x="7" y="6" width="18" height="2" />
    </svg>
  );
}
