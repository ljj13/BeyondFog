import { it,expect } from 'vitest';
import { readFileSync,existsSync } from 'node:fs';
it('ships document privacy and framing headers with Worker-first API-only routing',()=>{
  const headers=existsSync('public/_headers')?readFileSync('public/_headers','utf8'):'';
  expect(headers).toContain('Referrer-Policy: no-referrer');expect(headers).toContain("frame-ancestors 'none'");expect(headers).toContain('X-Frame-Options: DENY');
});
