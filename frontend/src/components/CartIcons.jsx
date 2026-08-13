export function CartIcon({ size = 20, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 4.5h2l1.65 9.1a2 2 0 0 0 1.97 1.65h8.35a2 2 0 0 0 1.95-1.52l1.1-4.48H7.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.4" cy="19.25" r="1.2" fill="currentColor" />
      <circle cx="17.2" cy="19.25" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function TrashIcon({ size = 15, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 7.5h13M10 3.8h4M8.4 7.5l.7 11h5.8l.7-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
