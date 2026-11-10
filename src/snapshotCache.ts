import { preferencesSchema,type Preferences } from './shared/preferences';

export type User={id:string;email:string;name:string};
export type CachedSnapshot={user:User;version:number;data:Preferences};

// The last snapshot this browser rendered. It is only a paint hint: a reload can show the real
// layout and wallpaper immediately instead of flashing the default shortcuts while the Durable
// Object wakes up. Every load still revalidates against the server, and a logout or a rejected
// session drops the copy.
const KEY='beyondfog.snapshot.v2';

function storage():Storage|null {
  try {return typeof localStorage==='undefined'?null:localStorage;} catch {return null;}   // some privacy modes throw on access
}

export function readCache():CachedSnapshot|null {
  const store=storage();if(!store)return null;
  try {
    const raw=store.getItem(KEY);if(!raw)return null;
    const parsed=JSON.parse(raw) as {user?:Partial<User>;version?:unknown;data?:unknown};
    if(typeof parsed?.user?.id!=='string'||typeof parsed.user.email!=='string')return null;
    if(typeof parsed.version!=='number'||!Number.isInteger(parsed.version)||parsed.version<0)return null;
    const data=preferencesSchema.parse(parsed.data);
    return {user:{id:parsed.user.id,email:parsed.user.email,name:typeof parsed.user.name==='string'?parsed.user.name:''},version:parsed.version,data};
  } catch {return null;}   // corrupt or outdated shape: fall back to a fresh load
}

export function writeCache(snapshot:CachedSnapshot):void {
  const store=storage();if(!store)return;
  try {store.setItem(KEY,JSON.stringify(snapshot));} catch {}   // quota or private mode: the cache is optional
}

export function dropCache():void {
  const store=storage();if(!store)return;
  try {store.removeItem(KEY);} catch {}
}
