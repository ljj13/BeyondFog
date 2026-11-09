// Single source of truth for document security headers. public/_headers mirrors these values for static
// assets; tests/unit/static-headers.test.ts fails if the two ever drift apart.
export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';
export const STRICT_TRANSPORT_SECURITY = 'max-age=31536000';
// HSTS and CSP are https-only so local http development keeps working.
export function applySecurityHeaders(headers: Headers, secure: boolean): Headers {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  if (!secure) return headers;
  headers.set('Strict-Transport-Security', STRICT_TRANSPORT_SECURITY);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  return headers;
}
