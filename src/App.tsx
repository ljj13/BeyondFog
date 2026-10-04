import { useCallback,useEffect,useRef,useState } from 'react';
import { ArrowRight,Settings2,Plus,Search,Pencil,CloudFog as Fog,UserRound,RefreshCw } from 'lucide-react';
import { usePreferences } from './usePreferences';
import { Settings } from './Settings';
import { AuthDialog } from './AuthDialog';
import { wallpapers,searchUrl,moveShortcut } from './shared/preferences';
import { EnginePicker } from './EnginePicker';
import { ShortcutIcon } from './ShortcutIcon';

function greeting(hour:number) {return hour<6?'夜色安静，发现继续。':hour<12?'早上好，新的发现从这里开始。':hour<18?'下午好，留一点时间给好奇。':'晚上好，让思绪慢下来。';}
export default function App() {
  const model=usePreferences(),{data,user,edit}=model;
  const [now,setNow]=useState(()=>new Date()),[query,setQuery]=useState(''),[panel,setPanel]=useState(false),[shortcut,setShortcut]=useState<string>(),[auth,setAuth]=useState(false),[change,setChange]=useState(false),[drag,setDrag]=useState<number|null>(null),[wallpaperError,setWallpaperError]=useState(false),[imageAttempt,setImageAttempt]=useState(0);
  const token=new URLSearchParams(location.search).get('token')??undefined;
  const previousUser=useRef<string|null>(null);
  useEffect(()=>{if(previousUser.current&&!user){setPanel(false);setShortcut(undefined);if(change){setAuth(false);setChange(false);}}previousUser.current=user?.id??null;},[user,change]);
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(t);},[]);
  useEffect(()=>{if(token)setAuth(true);if(new URLSearchParams(location.search).has('error'))model.notify('重置链接已失效，请重新申请');},[]);
  useEffect(()=>{setWallpaperError(false);},[data.wallpaper,imageAttempt]);
  const closePanel=useCallback(()=>{setPanel(false);setShortcut(undefined);},[]);
  const closeAuth=useCallback(()=>{setAuth(false);setChange(false);if(token)history.replaceState(null,'','/');},[token]);
  function openAuth(changePassword=false) {setPanel(false);setChange(changePassword);setAuth(true);}
  const wallpaper=data.wallpaper;
  const selected=wallpaper.kind==='builtin'?wallpapers.find(w=>w.id===wallpaper.id)??wallpapers[0]:null;
  const src=!wallpaperError&&data.wallpaper.kind==='webdav'&&user?`/api/webdav/image?file=${encodeURIComponent(data.wallpaper.file)}&attempt=${imageAttempt}`:`/wallpapers/${selected?.id??'alpine-mist'}.jpg`;
  const time=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const date=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
  return <div className="home"><img key={src} className="backdrop" src={src} alt="" onError={()=>{if(!wallpaperError&&data.wallpaper.kind==='webdav')setWallpaperError(true);}}/><div className="backdrop-shade" style={{'--dim':data.dim} as React.CSSProperties}/>
    <header className="home-header"><a className="brand" href="/" aria-label="BeyondFog 首页"><Fog size={27} strokeWidth={1.5}/><span>BeyondFog</span></a><div className="header-actions"><button className="login-button" onClick={()=>user?setPanel(true):openAuth()}><UserRound size={15}/><span>{user?'我的空间':'登录'}</span></button><button className="icon-button glass" aria-label="打开设置" onClick={()=>setPanel(true)}><Settings2 size={19}/></button></div></header>
    <main className="home-content"><section className="clock" aria-label="当地时间"><p className="greeting">{greeting(now.getHours())}</p><time dateTime={now.toISOString()}>{time}</time><p className="date">{date}</p></section>
    <form className="search-form" role="search" onSubmit={e=>{e.preventDefault();if(!query.trim())return;const url=searchUrl(data.engine,query.trim());if(data.newTab)window.open(url,'_blank','noopener,noreferrer');else location.assign(url);}}><div className="engine-wrap"><EnginePicker label="搜索引擎" variant="search" value={data.engine} onChange={engine=>edit(d=>({...d,engine}))}/></div><span className="search-divider"/><Search className="search-symbol" size={19}/><input type="search" aria-label="搜索内容" placeholder="想发现些什么？" autoComplete="off" value={query} onChange={e=>setQuery(e.target.value)}/><button type="submit" className="search-submit" aria-label="开始搜索"><ArrowRight size={21}/></button></form>
    <section className="shortcuts" aria-label="常用网站"><div className="shortcut-grid">{data.shortcuts.map((s,i)=>{return <div key={s.id} className="shortcut-item" draggable onDragStart={()=>setDrag(i)} onDragEnd={()=>setDrag(null)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(drag!==null)edit(d=>({...d,shortcuts:moveShortcut(d.shortcuts,drag,i)}));setDrag(null);}}><a className="shortcut-link" href={s.url} target="_blank" rel="noreferrer"><span className="shortcut-icon"><ShortcutIcon url={s.url} title={s.title}/></span><span>{s.title}</span></a><button className="shortcut-edit" aria-label={`编辑捷径 ${s.title}`} onClick={()=>{setShortcut(s.id);setPanel(true);}}><Pencil size={12}/></button></div>;})}<button className="add-shortcut" aria-label="添加捷径" disabled={data.shortcuts.length>=100} title={data.shortcuts.length>=100?"捷径已满（最多 100 个）":undefined} onClick={()=>{setShortcut('new');setPanel(true);}}><span className="shortcut-icon"><Plus size={24} strokeWidth={1.5}/></span><span>添加捷径</span></button></div><button className="manage-shortcuts" onClick={()=>{setShortcut('manage');setPanel(true);}}>整理捷径</button></section>
    {wallpaperError&&<div className="wallpaper-notice" role="status">网盘壁纸暂不可用，已显示默认风景。<button onClick={()=>setImageAttempt(v=>v+1)}><RefreshCw size={13}/>重试</button></div>}
    {model.conflict&&<button className="wallpaper-notice" onClick={()=>setPanel(true)}>设置同步冲突 · 本地编辑已保留，打开设置处理</button>}
    </main><footer className="home-footer"><span className="home-motto">BEYOND THE FOG, MORE TO DISCOVER.</span><a className="photo-credit" href={selected?.source??wallpapers[0].source} target="_blank" rel="noreferrer">{data.wallpaper.kind==='webdav'&&!wallpaperError&&user?'你的私人壁纸':`摄影 / ${selected?.author??wallpapers[0].author}`}<span>↗</span></a></footer>
    {panel&&<Settings model={model} onClose={closePanel} onAuth={()=>openAuth()} onChangePassword={()=>openAuth(true)} initialShortcut={shortcut}/>}
    {auth&&<AuthDialog onClose={closeAuth} onLogin={model.login} token={token} change={change}/>}
  </div>;
}
