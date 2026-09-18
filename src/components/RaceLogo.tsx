/**
 * Race logo thumbnail. Renders nothing when no logo has been set yet — drop files in
 * public/race-logos/ and set Race.logoUrl to use one (same convention as Team.jerseyUrl).
 */
export function RaceLogo({ logoUrl, className = "h-6 w-6 rounded object-contain" }: { logoUrl: string | null | undefined; className?: string }) {
  if (!logoUrl) return null;
  return <img src={logoUrl} alt="" className={`shrink-0 ${className}`} />;
}
