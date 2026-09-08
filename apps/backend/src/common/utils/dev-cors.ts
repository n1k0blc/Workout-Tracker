/**
 * Which origins the API accepts in development.
 *
 * Dev only. Production uses a strict explicit allowlist from `CORS_ORIGIN` and never calls
 * this -- see the `isProduction` branch in `main.ts`.
 *
 * The intent has always been "this machine and the phones on its network". What changed is
 * that dev now also runs over HTTPS: the barcode scanner (#149) needs a camera, `getUserMedia`
 * needs a secure context, and a phone reaches the dev server by LAN address or Bonjour name.
 * The scheme is therefore no longer part of the question -- the *host* is.
 *
 * Parsed rather than prefix-matched, which is also what makes it correct: `http://192.168.`
 * is a prefix of `http://192.168.attacker.com`, so the string checks this replaces let a
 * public host through.
 */

/** 172.16.0.0/12 -- the private block, which is 172.16 through 172.31 and no further. */
function isPrivate172(parts: number[]): boolean {
  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  if (!parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || a === 127 || (a === 192 && b === 168) || isPrivate172(parts.map(Number));
}

export function isLocalDevOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

  // `URL` lowercases the host and strips the port for us; IPv6 arrives bracketed.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return (
    host === 'localhost' ||
    host === '::1' ||
    // Bonjour names, which is how a phone reaches a Mac without a DHCP-dependent address.
    host.endsWith('.local') ||
    isPrivateIpv4(host)
  );
}
