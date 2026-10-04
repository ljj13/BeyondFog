import { it, expect } from 'vitest';
import { parseListing, limitedStream } from '../../worker/webdav';
const folder = 'https://dav.example.com/dav/BeyondFog/wallpapers/';
const response = (href: string, size = '42', status = 'HTTP/1.1 200 OK') => `<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:getcontentlength>${size}</d:getcontentlength><d:resourcetype/></d:prop><d:status>${status}</d:status></d:propstat></d:response>`;
it('only lists direct supported images from successful same-host properties', () => {
  const xml = `<d:multistatus xmlns:d="DAV:">${response('/dav/BeyondFog/wallpapers/%E5%B1%B1.jpg')}${response('https://evil.com/dav/BeyondFog/wallpapers/leak.jpg')}${response('/dav/BeyondFog/wallpapers/sub/x.jpg')}${response('/dav/BeyondFog/wallpapers/a.svg')}${response('/dav/BeyondFog/wallpapers/b.jpg','42','HTTP/1.1 403 Forbidden')}${response('/dav/BeyondFog/wallpapers/c.png','99999999')}</d:multistatus>`;
  expect(parseListing(xml, folder)).toEqual([{name: '山.jpg', size: 42}]);
});
it('rejects XML entity declarations', () => { expect(() => parseListing('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><x/>', folder)).toThrow(); });
it('streams and enforces the exact declared byte count', async () => {
  const stream = (values: number[]) => new ReadableStream<Uint8Array>({start(c) {values.forEach(n => c.enqueue(new Uint8Array(n))); c.close();}});
  expect((await new Response(limitedStream(stream([4,5]),9)).arrayBuffer()).byteLength).toBe(9);
  await expect(new Response(limitedStream(stream([4,6]),9)).arrayBuffer()).rejects.toThrow();
  await expect(new Response(limitedStream(stream([4,4]),9)).arrayBuffer()).rejects.toThrow();
});
