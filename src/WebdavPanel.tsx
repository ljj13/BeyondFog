import { useEffect,useRef,useState } from 'react';
import { Cloud,RefreshCw,Upload,Check,ImageIcon } from 'lucide-react';
import { api,ApiError } from './api';
type Connection={configured:boolean;version:number;endpoint:string;username:string;directory:string;allowedHosts:string[]};
export function WebdavPanel({selected,onSelect,onExpired}:{selected?:string;onSelect:(file:string)=>void;onExpired:()=>void}) {
  const [connection,setConnection]=useState<Connection|null>(null),[password,setPassword]=useState(''),[files,setFiles]=useState<{name:string;size:number}[]>([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null),alive=useRef(true);
  const input=useRef<HTMLInputElement>(null);
  async function listing(signal?:AbortSignal) {
    const value=await api<{files:typeof files;message?:string}>('/api/webdav/files','GET',undefined,signal);
    if(alive.current){setFiles(value.files);if(value.message)setNotice(value.message);}
  }
  async function act(fn:(signal:AbortSignal)=>Promise<void>) {
    const c=new AbortController();controller.current=c;setBusy(true);setError('');setNotice('');
    try {await fn(c.signal);}catch(e){if(alive.current&&!c.signal.aborted){setError((e as Error).message);if(e instanceof ApiError&&e.status===401)onExpired();}}finally{if(alive.current)setBusy(false);}
  }
  useEffect(()=>{alive.current=true;void act(async signal=>{const c=await api<Connection>('/api/webdav/connection','GET',undefined,signal);if(!alive.current)return;setConnection(c);if(c.configured)await listing(signal);});return()=>{alive.current=false;controller.current?.abort();};},[]);
  async function save(e:React.FormEvent) {e.preventDefault();if(!connection)return;await act(async signal=>{const c=await api<Connection>('/api/webdav/connection','PUT',{version:connection.version,endpoint:connection.endpoint,username:connection.username,directory:connection.directory,...(password?{password}:{})},signal);if(alive.current){setConnection(c);setPassword('');setFiles([]);setNotice('连接已保存，应用密码不会显示。请测试连接。');}});}
  return <div><div className="section-heading"><Cloud size={19}/><h3>你的壁纸，留在你的网盘</h3></div><p className="description">使用 WebDAV 连接，保留图片原貌。支持坚果云和获准的 HTTPS 网盘。</p>
    {connection&&<form onSubmit={save} className="connection-form"><button className="preset text-button" type="button" onClick={()=>setConnection({...connection,endpoint:'https://dav.jianguoyun.com/dav/'})}>使用坚果云预设</button>
      <label>服务器地址<input type="url" required value={connection.endpoint} onChange={e=>setConnection({...connection,endpoint:e.target.value})}/></label>
      <label>账号<input required autoComplete="off" value={connection.username} onChange={e=>setConnection({...connection,username:e.target.value})}/></label>
      <label>应用密码{connection.configured&&<span className="configured">已配置</span>}<input type="password" autoComplete="new-password" required={!connection.configured} value={password} onChange={e=>setPassword(e.target.value)} placeholder={connection.configured?'留空保留当前密码':'网盘专用应用密码'}/></label>
      <label>壁纸目录<input required value={connection.directory} onChange={e=>setConnection({...connection,directory:e.target.value})}/></label>
      <p className="hint">当前允许：{connection.allowedHosts.join('、')}。其他网盘需先在部署配置中添加服务器域名。</p>
      <div className="button-row"><button className="primary" disabled={busy}>保存连接</button><button type="button" disabled={busy||!connection.configured} onClick={()=>void act(async signal=>{const r=await api('/api/webdav/test','POST',{},signal);if(alive.current)setNotice(r.message);await listing(signal);})}>测试连接</button></div>
    </form>}
    {error&&<p role="alert" className="error">{error}<button className="text-button" onClick={()=>void act(async signal=>{const c=await api<Connection>('/api/webdav/connection','GET',undefined,signal);if(alive.current){setConnection(c);setPassword('');}})}>重新加载连接</button></p>}{notice&&<p className="success" role="status">{notice}</p>}
    <div className="section-heading divided"><h3>网盘壁纸</h3><div className="button-row"><button className="icon-button" aria-label="刷新网盘壁纸" disabled={busy||!connection?.configured} onClick={()=>void act(listing)}><RefreshCw size={17} className={busy?'spinning':''}/></button><button className="small" disabled={busy||!connection?.configured} onClick={()=>input.current?.click()}><Upload size={15}/>上传</button></div></div>
    <input ref={input} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>20*1024*1024){setError('每张图片最多 20 MB');return;}if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setError('请选择 JPEG、PNG 或 WebP 图片');return;}void act(async signal=>{const r=await fetch('/api/webdav/upload',{method:'POST',headers:{'Content-Type':file.type,'X-File-Size':String(file.size)},body:file,signal});const result=await r.json() as {error?:string;name:string};if(!r.ok)throw new ApiError(r.status,result.error||'上传失败');if(alive.current){setNotice('上传完成，已选择这张壁纸');onSelect(result.name);}await listing(signal);});}}/>
    <p className="hint">JPEG、PNG、WebP · 单张最多 20 MB · 上传不会覆盖已有文件</p>
    {!files.length&&<div className="empty"><ImageIcon size={30}/><p>{busy?'正在读取…':'还没有可用的网盘壁纸'}</p><span>保存并测试连接后，选择图片或上传一张。</span></div>}
    <div className="file-list">{files.map(f=><button className={`file-row ${selected===f.name?'selected':''}`} key={f.name} onClick={()=>onSelect(f.name)}><ImageIcon size={19}/><span>{f.name}<small>{(f.size/1024/1024).toFixed(2)} MB</small></span>{selected===f.name&&<Check size={17}/>}</button>)}</div>
  </div>;
}
