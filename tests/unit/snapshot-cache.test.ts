import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { defaults } from '../../src/shared/preferences';
import { dropCache,readCache,writeCache } from '../../src/snapshotCache';

// The cache only exists to make a reload paint instantly; anything it cannot trust must be dropped,
// because a bad entry would either break the first render or resurrect a stale private snapshot.
function memoryStorage() {
  const store=new Map<string,string>();
  return {
    getItem:(key:string)=>store.get(key)??null,
    setItem:(key:string,value:string)=>{store.set(key,String(value));},
    removeItem:(key:string)=>{store.delete(key);},
    clear:()=>store.clear(),
    key:(index:number)=>[...store.keys()][index]??null,
    get length(){return store.size;},
    store,
  } as unknown as Storage&{store:Map<string,string>};
}
const user={id:'owner-1',email:'owner@example.com',name:'Owner'};
let storage:Storage&{store:Map<string,string>};
beforeEach(()=>{storage=memoryStorage();Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});});
afterEach(()=>{Object.defineProperty(globalThis,'localStorage',{value:undefined,configurable:true});});
describe('snapshot cache',()=>{
  it('falls back to a fresh load when the browser has no storage',()=>{
    Object.defineProperty(globalThis,'localStorage',{value:undefined,configurable:true});
    expect(readCache()).toBeNull();
    expect(()=>writeCache({user,version:1,data:defaults})).not.toThrow();
    expect(()=>dropCache()).not.toThrow();
  });
  it('round-trips a snapshot so the next visit can paint it before the network answers',()=>{
    writeCache({user,version:7,data:{...defaults,shortcutLayout:'folders'}});
    const cached=readCache();
    expect(cached?.user).toEqual(user);
    expect(cached?.version).toBe(7);
    expect(cached?.data.shortcutLayout).toBe('folders');
  });
  it('drops a corrupt entry instead of crashing the first render',()=>{
    storage.setItem('beyondfog.snapshot.v2','{not json');
    expect(readCache()).toBeNull();
  });
  it('drops an entry whose payload no longer satisfies the schema',()=>{
    storage.setItem('beyondfog.snapshot.v2',JSON.stringify({user,version:3,data:{...defaults,shortcutLayout:'masonry'}}));
    expect(readCache()).toBeNull();
  });
  it('ignores an entry without a usable owner or version',()=>{
    storage.setItem('beyondfog.snapshot.v2',JSON.stringify({user:{email:'owner@example.com'},version:1,data:defaults}));
    expect(readCache()).toBeNull();
    storage.setItem('beyondfog.snapshot.v2',JSON.stringify({user,version:'1',data:defaults}));
    expect(readCache()).toBeNull();
  });
  it('forgets the snapshot on logout so the next visitor cannot see it',()=>{
    writeCache({user,version:2,data:defaults});
    dropCache();
    expect(readCache()).toBeNull();
  });
});
