import { useCallback,useEffect,useRef,useState } from 'react';
import { api,ApiError } from './api';
import { defaults,preferencesSchema,type Preferences } from './shared/preferences';
type Snapshot={version:number;data:Preferences};
type User={id:string;email:string;name:string};
export function usePreferences() {
  const [data,setData]=useState<Preferences>(structuredClone(defaults));
  const [user,setUser]=useState<User|null>(null);
  const [status,setStatus]=useState('正在连接');
  const [message,setMessage]=useState('');
  const [conflict,setConflict]=useState(false);
  const [loggingOut,setLoggingOut]=useState(false);
  const refresh=useRef(0),exiting=useRef(false);
  const current=useRef(data), actor=useRef<User|null>(null), revision=useRef(0), generation=useRef(0), seq=useRef(0), dirty=useRef(false), busy=useRef(false), blocked=useRef(false), saving=useRef<Promise<void>|null>(null);
  const clear=useCallback(()=>{
    generation.current++;refresh.current++;actor.current=null;setUser(null);dirty.current=false;blocked.current=false;setConflict(false);
    current.current=structuredClone(defaults);setData(current.current);revision.current=0;setStatus('访客模式');
  },[]);
  const load=useCallback(async(force=false)=>{
    if(exiting.current)return;
    const gen=generation.current,requestId=++refresh.current,editSeq=seq.current;
    try {
      const session=await api<{user:User}|null>('/api/auth/get-session');
      if(gen!==generation.current||requestId!==refresh.current) return;
      if(!session?.user) {if(actor.current) {clear();setMessage('会话已结束，私人内容已清除');}else setStatus('访客模式');return;}
      const snap=await api<Snapshot>('/api/preferences');
      if(gen!==generation.current||requestId!==refresh.current||snap.version<revision.current) return;
      // Explicit reload discards only edits that existed when it began; subsequent edits survive.
      if(force&&editSeq!==seq.current)return;
      if(busy.current&&!force) return;
      if((dirty.current||busy.current)&&!force) {
        if(snap.version!==revision.current) {blocked.current=true;setConflict(true);setStatus('同步冲突');setMessage('其他设备有新设置，本地编辑已保留。');}
        return;
      }
      actor.current=session.user;setUser(session.user);revision.current=snap.version;
      current.current=preferencesSchema.parse(snap.data);setData(current.current);dirty.current=false;blocked.current=false;setConflict(false);setStatus('已同步');setMessage('');
    } catch(e) {
      if(gen!==generation.current||requestId!==refresh.current)return;
      if(e instanceof ApiError&&e.status===401) clear();
      setStatus('连接失败');setMessage((e as Error).message||'无法连接账号服务');
    }
  },[clear]);
  const flush=useCallback(async():Promise<void>=>{
    if(!actor.current||!dirty.current||busy.current||blocked.current)return;
    const gen=generation.current, sentSeq=seq.current, sent=current.current;
    busy.current=true;setStatus('正在保存');
    try {
      const snap=await api<Snapshot>('/api/preferences','PUT',{schemaVersion:2,version:revision.current,data:sent});
      if(gen!==generation.current)return;
      revision.current=snap.version;
      if(seq.current===sentSeq) {dirty.current=false;setStatus('已同步');setMessage('');}
    } catch(e) {
      if(gen!==generation.current)return;
      if(e instanceof ApiError&&e.status===401) {clear();setMessage('会话已过期，私人内容已清除');return;}
      if(e instanceof ApiError&&e.status===409) {blocked.current=true;setConflict(true);setStatus('同步冲突');}
      else {blocked.current=true;setStatus('保存失败');}
      setMessage((e as Error).message);
    } finally {busy.current=false;}
    if(gen===generation.current&&dirty.current&&!blocked.current) await flush();
  },[clear]);
  useEffect(()=>{void load();const focus=()=>{if(document.visibilityState==='visible')void load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);return()=>{window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};},[load]);
  useEffect(()=>{if(!dirty.current)return;const t=setTimeout(()=>{if(!busy.current&&!exiting.current)saving.current=flush();},550);return()=>clearTimeout(t);},[data,flush]);
  const edit=useCallback((fn:(old:Preferences)=>Preferences)=>{
    if(exiting.current)return;
    current.current=preferencesSchema.parse(fn(current.current));seq.current++;dirty.current=Boolean(actor.current);setData(current.current);setStatus(actor.current?'等待保存':'访客模式');
  },[]);
  const login=useCallback(async()=>{generation.current++;dirty.current=false;blocked.current=false;await load(true);},[load]);
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
  const retry=useCallback(()=>{blocked.current=false;if(!busy.current)saving.current=flush();},[flush]);
  return {data,user,status,message,conflict,loggingOut,edit,login,logout,reload:()=>load(true),retry,notify:setMessage};
}
