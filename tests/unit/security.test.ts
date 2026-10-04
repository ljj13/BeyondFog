import { describe, it, expect } from 'vitest';
import { normalizeEndpoint, normalizeDirectory, fileUrl, seal, unseal, imageType } from '../../worker/security';

describe('WebDAV request boundaries', () => {
  it('normalizes public HTTPS connections', () => {
    expect(normalizeEndpoint('https://dav.jianguoyun.com/dav')).toBe('https://dav.jianguoyun.com/dav/');
    expect(normalizeDirectory('BeyondFog/wallpapers/')).toBe('BeyondFog/wallpapers');
  });
  it('normalizes Unicode endpoint paths idempotently', () => {
    const endpoint=normalizeEndpoint('https://dav.example.com/我的网盘/');
    expect(normalizeEndpoint(endpoint)).toBe(endpoint);
    expect(fileUrl(endpoint,'BeyondFog','山.jpg')).toContain('/%E6%88%91%E7%9A%84%E7%BD%91%E7%9B%98/BeyondFog/');
  });
  it.each(['http://example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://169.254.169.254/', 'https://user:pass@example.com/', 'https://example.com/?target=evil', 'https://foo.local/'])('rejects unsafe endpoint %s', value => {
    expect(() => normalizeEndpoint(value)).toThrow();
  });
  it.each(['../secret', '%2e%2e/secret', 'a/../../b', '/etc', 'https://evil.com', 'a\\b', '%252e%252e', 'a%2fb'])('rejects escaped directory %s', value => {
    expect(() => normalizeDirectory(value)).toThrow();
  });
  it('keeps Unicode filenames within the configured directory', () => {
    expect(fileUrl('https://dav.example.com/dav/', 'BeyondFog/wallpapers', '山 雾.jpg')).toBe('https://dav.example.com/dav/BeyondFog/wallpapers/%E5%B1%B1%20%E9%9B%BE.jpg');
    expect(() => fileUrl('https://dav.example.com/dav/', 'BeyondFog', '../secret.jpg')).toThrow();
    expect(() => fileUrl('https://dav.example.com/dav/', 'BeyondFog', '%2fsecret.jpg')).toThrow();
  });
});
describe('credential encryption', () => {
  const key = '10'.repeat(32);
  it('round trips credentials without revealing plaintext', async () => {
    const encoded = await seal('app-password-secret', key, 'owner-a');
    expect(JSON.stringify(encoded)).not.toContain('app-password-secret');
    expect(await unseal(encoded, key, 'owner-a')).toBe('app-password-secret');
    expect(await seal('app-password-secret', key, 'owner-a')).not.toEqual(encoded);
  });
  it('rejects modified, wrong-key and cross-owner ciphertext', async () => {
    const encoded = await seal('secret', key, 'owner-a');
    await expect(unseal(encoded, key, 'owner-b')).rejects.toThrow();
    await expect(unseal(encoded, '11'.repeat(32), 'owner-a')).rejects.toThrow();
    await expect(unseal({ ...encoded, data: encoded.data.slice(0, -4) + 'AAAA' }, key, 'owner-a')).rejects.toThrow();
  });
});
describe('image signatures', () => {
  it('uses file bytes instead of trusting the supplied MIME type', () => {
    expect(imageType(new Uint8Array([255,216,255,224]))).toBe('image/jpeg');
    expect(imageType(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
  });
});
