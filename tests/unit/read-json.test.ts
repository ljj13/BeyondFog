import { describe,it,expect } from 'vitest';
import { Problem,readJson } from '../../worker/types';

function jsonRequest(body:string) {
  return new Request('https://beyondfog.test/api/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body});
}
async function status(promise:Promise<unknown>) {
  try {await promise;return 200;} catch(e) {return e instanceof Problem?e.status:(()=>{throw e;})();}
}
describe('readJson',()=>{
  it('requires a JSON content type',async()=>{
    const request=new Request('https://beyondfog.test/api/preferences',{method:'PUT',headers:{'Content-Type':'text/plain'},body:'{}'});
    expect(await status(readJson(request))).toBe(415);
  });
  it('rejects a body above the default 64 KB auth cap',async()=>{
    expect(await status(readJson(jsonRequest(JSON.stringify({password:'x'.repeat(70000)}))))).toBe(413);
  });
  it('accepts preferences up to the larger explicit limit',async()=>{
    const body=JSON.stringify({schemaVersion:2,data:{url:'x'.repeat(120000)}});
    expect(body.length).toBeGreaterThan(65536);
    expect(await status(readJson(jsonRequest(body),262144))).toBe(200);
    expect(await status(readJson(jsonRequest(body)))).toBe(413);
  });
  it('rejects malformed JSON with 400',async()=>{
    expect(await status(readJson(jsonRequest('{"broken":')))).toBe(400);
  });
  it('rejects a missing body',async()=>{
    const request=new Request('https://beyondfog.test/api/preferences',{method:'PUT',headers:{'Content-Type':'application/json'}});
    expect(await status(readJson(request))).toBe(400);
  });
});
