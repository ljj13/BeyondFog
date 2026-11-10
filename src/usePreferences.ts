import { useCallback,useEffect,useRef,useState } from 'react';
import { api,ApiError } from './api';
import { defaults,preferencesSchema,type Preferences } from './shared/preferences';
import { dropCache,readCache,writeCache,type User } from './snapshotCache';
type Snapshot={version:number;data:Preferences;recovered?:boolean};
export function usePreferences() {
  // A cached snapshot turns a reload into an instant paint; without one the shortcut area stays a
  // skeleton until the first answer, so the default grid never flashes before the real folders.
  const [cached]=useState(readCache);
  const [data,setData]=useState<Preferences>(()=>cached?structuredClone(cached.data):structuredClone(defaults));
  const [user,setUser]=useState<User|null>(()=>cached?.user??null);
  const [ready,setReady]=useState(Boolean(cached));
  const [status,setStatus]=useState(cached?'正在刷新':'正在连接');
  const [message,setMessage]=useState('');
  const [conflict,setConflict]=useState(false);
  const [loggingOut,setLoggingOut]=useState(false);
  const [blockedState,setBlockedState]=useState(false);
  const refresh=useRef(0),exiting=useRef(false);
  const current=useRef(data), actor=useRef<User|null>(cached?.user??null), revision=useRef(cached?.version??0), generation=useRef(0), seq=useRef(0), dirty=useRef(false), busy=useRef(false), blocked=useRef(false), synced=useRef(Boolean(cached)), saving=useRef<Promise<void>|null>(null);
  const markBlocked=useCallback((value:boolean)=>{blocked.current=value;setBlockedState(value);},[]);
  const clear=useCallback(()=>{
    generation.current++;refresh.current++;actor.current=null;setUser(null);dirty.current=false;synced.current=false;markBlocked(false);setConflict(false);
    current.current=structuredClone(defaults);setData(current.current);revision.current=0;setStatus('访客模式');
    dropCache();setReady(true);
  },[markBlocked]);
  const load=useCallback(async(force=false)=>{
    if(exiting.current)return;
    // An explicit reload fences in-flight saves so a late response cannot restore a stale revision.
    if(force)generation.current++;
    const gen=generation.current,requestId=++refresh.current,editSeq=seq.current;
    try {
      // Both reads only need the stored cookie, so they share one round trip (and one cold Durable
      // Object start) instead of running nose to tail.
      const [sessionResult,snapResult]=await Promise.allSettled([api<{user:User}|null>('/api/auth/get-session'),api<Snapshot>('/api/preferences')]);
      if(gen!==generation.current)return;
      const session=sessionResult.status==='fulfilled'?sessionResult.value:null;
      // Adopt the identity before any fence: a failed or superseded snapshot must never look like a logout.
      if(session?.user){actor.current=session.user;setUser(session.user);}
      if(requestId!==refresh.current)return;   // a newer load owns the rest of this answer
      if(sessionResult.status==='rejected')throw sessionResult.reason;
      if(!session?.user) {
        if(actor.current) {clear();setMessage('会话已结束，私人内容已清除');}
        else {setStatus('访客模式');setReady(true);}
        return;
      }
      if(snapResult.status==='rejected')throw snapResult.reason;
      const snap=snapResult.value;
      if(snap.version<revision.current) {setReady(true);return;}
      // Explicit reload discards only edits that existed when it began; subsequent edits survive.
      if(force&&editSeq!==seq.current)return;
      if(busy.current&&!force) return;
      if((dirty.current||busy.current)&&!force) {
        if(snap.version!==revision.current) {markBlocked(true);setConflict(true);setStatus('同步冲突');setMessage('其他设备有新设置，本地编辑已保留。');}
        setReady(true);
        return;
      }
      revision.current=snap.version;synced.current=true;
      current.current=preferencesSchema.parse(snap.data);setData(current.current);dirty.current=false;markBlocked(false);setConflict(false);setStatus('已同步');setMessage(snap.recovered?'云端设置无法读取，已载入默认值；保存一次即可覆盖。':'');
      if(actor.current)writeCache({user:actor.current,version:snap.version,data:current.current});
      setReady(true);
    } catch(e) {
      if(gen!==generation.current)return;
      if(e instanceof ApiError&&e.status===401) {clear();return;}
      const detail=(e as Error).message||'无法连接账号服务';
      setStatus('连接失败');setMessage(actor.current?`无法加载云端设置，正在显示默认内容。${detail}`:detail);setReady(true);
    }
  },[clear,markBlocked]);
  const flush=useCallback(async():Promise<void>=>{
    // Nothing is writable before the first snapshot: a save without its version would only produce a conflict.
    if(!actor.current||!synced.current||!dirty.current||busy.current||blocked.current)return;
    const gen=generation.current, sentSeq=seq.current, sent=current.current;
    busy.current=true;setStatus('正在保存');
    try {
      const snap=await api<Snapshot>('/api/preferences','PUT',{schemaVersion:2,version:revision.current,data:sent});
      if(gen!==generation.current)return;
      revision.current=snap.version;
      if(actor.current)writeCache({user:actor.current,version:snap.version,data:current.current});
      if(seq.current===sentSeq) {dirty.current=false;setStatus('已同步');setMessage('');}
    } catch(e) {
      if(gen!==generation.current)return;
      if(e instanceof ApiError&&e.status===401) {clear();setMessage('会话已过期，私人内容已清除');return;}
      if(e instanceof ApiError&&e.status===409) {markBlocked(true);setConflict(true);setStatus('同步冲突');}
      else {markBlocked(true);setStatus('保存失败');}
      setMessage((e as Error).message);
    } finally {busy.current=false;}
    if(gen===generation.current&&dirty.current&&!blocked.current) await flush();
  },[clear,markBlocked]);
  useEffect(()=>{void load();const focus=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[load]);
  useEffect(()=>{if(!dirty.current)return;const t=setTimeout(()=>{if(!busy.current&&!exiting.current)saving.current=flush();},550);return()=>clearTimeout(t);},[data,flush]);
  const edit=useCallback((fn:(old:Preferences)=>Preferences)=>{
    if(exiting.current)return;
    const next=fn(current.current);if(next===current.current)return;
    current.current=preferencesSchema.parse(next);seq.current++;dirty.current=Boolean(actor.current)&&synced.current;setData(current.current);
    // A failed or conflicting save keeps its own status and retry button until the owner resolves it,
    // and an unloaded snapshot keeps the connection notice instead of claiming the edit is being saved.
    if(!blocked.current&&synced.current)setStatus(actor.current?'等待保存':'访客模式');
  },[]);
  const login=useCallback(async()=>{generation.current++;dirty.current=false;markBlocked(false);await load(true);},[load,markBlocked]);
  const logout=useCallback(async(discard=false)=>{
    if(exiting.current)return;
    // Fence refreshes, freeze new edits, then drain the complete save chain before destroying the session.
    exiting.current=true;setLoggingOut(true);refresh.current++;
    try {
      await saving.current;
      if(!discard){saving.current=flush();await saving.current;if(dirty.current)throw new Error('尚有未保存的编辑。请重试保存、处理同步冲突，或选择放弃编辑并退出。');}
      await api('/api/auth/sign-out','POST',{});clear();setMessage('已退出，私人内容已清除');
    } catch(e) {setMessage((e as Error).message);throw e;}
    finally {exiting.current=false;setLoggingOut(false);}
  },[clear,flush]);
  const retry=useCallback(()=>{markBlocked(false);if(!busy.current)saving.current=flush();},[flush,markBlocked]);
  const reload=useCallback(()=>{void load(true);},[load]);
  return {data,user,status,message,conflict,blocked:blockedState,loggingOut,ready,edit,login,logout,reload,retry,notify:setMessage};
}
