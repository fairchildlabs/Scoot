export function ScootLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={className}
      fill="currentColor"
    >
      <path d="M50 90c-22.1 0-40-17.9-40-40s17.9-40 40-40 40 17.9 40 40-17.9 40-40 40zm0-5c19.3 0 35-15.7 35-35s-15.7-35-35-35-35 15.7-35 35 15.7 35 35 35z"/>
      <path d="M35 65V35h30l-10 15 10 15H35z"/>
    </svg>
  );
}
