import { describe,it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
import { applySecurityHeaders,CONTENT_SECURITY_POLICY,PERMISSIONS_POLICY,STRICT_TRANSPORT_SECURITY } from '../../worker/headers';

// The Worker response is what browsers actually receive; public/_headers only covers asset requests.
const expected = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer',
  'X-Frame-Options':'DENY',
  'Strict-Transport-Security':STRICT_TRANSPORT_SECURITY,
  'Permissions-Policy':PERMISSIONS_POLICY,
  'Content-Security-Policy':CONTENT_SECURITY_POLICY,
};
function staticHeaders() {
  const text=existsSync('public/_headers')?readFileSync('public/_headers','utf8'):'';
  const pairs:Record<string,string>={};
  for (const line of text.split(/\r?\n/)) {
    const match=/^\s+([A-Za-z-]+):\s*(.+)$/.exec(line);
    if (match) pairs[match[1]]=match[2].trim();
  }
  return pairs;
}
it('serves document privacy and framing headers with Worker-first API-only routing',()=>{
  const headers=existsSync('public/_headers')?readFileSync('public/_headers','utf8'):'';
  expect(headers).toContain('Referrer-Policy: no-referrer');expect(headers).toContain("frame-ancestors 'none'");expect(headers).toContain('X-Frame-Options: DENY');
});
describe('security headers',()=>{
  it('keeps public/_headers byte-identical to the Worker source of truth',()=>{
    expect(staticHeaders()).toEqual(expected);
  });
  it('sets every header on https responses',()=>{
    const headers=applySecurityHeaders(new Headers(),true);
    for (const [name,value] of Object.entries(expected)) expect(headers.get(name),name).toBe(value);
  });
  it('omits the https-only headers on plain http so local development keeps working',()=>{
    const headers=applySecurityHeaders(new Headers(),false);
    expect(headers.get('Content-Security-Policy')).toBeNull();
    expect(headers.get('Strict-Transport-Security')).toBeNull();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
  });
});
