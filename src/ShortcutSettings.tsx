import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { ShortcutIcon } from './ShortcutIcon';
import { FolderIcon } from './FolderIcon';
import { GlassSelect } from './GlassSelect';
import { PresetCatalog } from './PresetCatalog';
import { folderIconLabels } from './shared/folder-icons';
import { folderIcons, folderSchema, shortcutSchema, moveShortcut, type Shortcut, type Folder } from './shared/preferences';
import type { usePreferences } from './usePreferences';

export function ShortcutSettings({ model, initialShortcut, initialFolder }: {
  model: ReturnType<typeof usePreferences>; initialShortcut?: string; initialFolder?: string | null;
}) {
  const { data, edit, user } = model;
  const fresh = (): Shortcut => ({ id: crypto.randomUUID(), title: '', url: '', folderId: initialFolder ?? null });
  const [editing, setEditing] = useState<Shortcut | null>(initialShortcut === 'new' ? fresh() : data.shortcuts.find(s => s.id === initialShortcut) ?? null);
  const [folder, setFolder] = useState<Folder | null>(initialShortcut === 'new-folder' ? { id: crypto.randomUUID(), name: '' } : null);
  const [presetOpen,setPresetOpen]=useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [validation, setValidation] = useState('');
  const [filter, setFilter] = useState('all');
  const [drag, setDrag] = useState<{ kind: 'site' | 'folder'; id: string } | null>(null);
  const activeFilter = filter === 'all' || filter === 'none' || data.folders.some(f => `folder:${f.id}` === filter) ? filter : 'all';
  const visible = data.shortcuts.filter(s => activeFilter === 'all' || (activeFilter === 'none' ? s.folderId === null : s.folderId === activeFilter.slice(7)));
  const folderOptions=[{value:'',label:'未分类',icon:<FolderIcon icon="folder" size={18}/>,detail:`${data.shortcuts.filter(s=>s.folderId===null).length} 个网站`},...data.folders.map(f=>({value:f.id,label:f.name,icon:<FolderIcon name={f.name} icon={f.icon} size={18}/>,detail:`${data.shortcuts.filter(s=>s.folderId===f.id).length} 个网站`}))];
  const filterOptions=[{value:'all',label:'全部网站',icon:<FolderIcon icon="folder" size={18}/>,detail:`${data.shortcuts.length} 个网站`},...folderOptions.map(f=>({...f,value:f.value?`folder:${f.value}`:'none'}))];
  function orderSite(from: number, to: number) {
    const moved = moveShortcut(visible, from, to);
    const ids = new Set(visible.map(s => s.id)); let i = 0;
    edit(d => ({ ...d, shortcuts: d.shortcuts.map(s => ids.has(s.id) ? moved[i++] : s) }));
  }
  function saveSite(e: React.FormEvent) {
    e.preventDefault(); const result = shortcutSchema.safeParse(editing && { ...editing, folderId: data.folders.some(f => f.id === editing.folderId) ? editing.folderId : null });
    if (!result.success) { setValidation('请填写名称和有效的 http / https 网址'); return; }
    if (!data.shortcuts.some(s => s.id === result.data.id) && data.shortcuts.length >= 100) { setValidation('网站已满，最多 100 个'); return; }
    try { edit(d => ({ ...d, shortcuts: d.shortcuts.some(s => s.id === result.data.id) ? d.shortcuts.map(s => s.id === result.data.id ? result.data : s) : [...d.shortcuts, result.data] })); } catch { setValidation('无法保存，请检查网站数量与文件夹归属'); return; }
    setEditing(null); setValidation('');
  }
  function saveFolder(e: React.FormEvent) {
    e.preventDefault(); const result = folderSchema.safeParse(folder);
    if (!result.success) { setValidation('文件夹名称须为 1–24 个字符'); return; }
    if (!data.folders.some(f => f.id === result.data.id) && data.folders.length >= 20) { setValidation('文件夹已满，最多 20 个'); return; }
    try { edit(d => ({ ...d, folders: d.folders.some(f => f.id === result.data.id) ? d.folders.map(f => f.id === result.data.id ? result.data : f) : [...d.folders, result.data] })); } catch { setValidation('无法保存，请检查文件夹数量'); return; }
    setFolder(null); setValidation('');
  }
  return <>
    <fieldset className="layout-options"><legend>捷径显示方式</legend>
      <label><input type="radio" name="shortcut-layout" aria-label="平铺模式" checked={data.shortcutLayout === 'flat'} onChange={() => edit(d => ({ ...d, shortcutLayout: 'flat' }))}/><span>平铺<span>直接显示所有网站</span></span></label>
      <label><input type="radio" name="shortcut-layout" aria-label="文件夹模式" checked={data.shortcutLayout === 'folders'} onChange={() => edit(d => ({ ...d, shortcutLayout: 'folders' }))}/><span>文件夹<span>悬停或点击展开</span></span></label>
    </fieldset>
    <div className="section-heading"><h3>文件夹</h3><button className="small" disabled={data.folders.length >= 20} onClick={() => { setFolder({ id: crypto.randomUUID(), name: '' }); setValidation(''); }}><Plus size={16}/>新建文件夹</button></div>
    {folder && <form className="shortcut-form" onSubmit={saveFolder}><label>文件夹名称<input required maxLength={24} autoFocus value={folder.name} onChange={e => setFolder({ ...folder, name: e.target.value })}/></label><fieldset className="folder-icon-chooser"><legend>文件夹图标</legend><div className="folder-icon-choices">{folderIcons.map(icon=><button key={icon} type="button" aria-label={`文件夹图标 ${folderIconLabels[icon]}`} aria-pressed={(folder.icon??'auto')===icon} onClick={()=>setFolder({...folder,icon})}><FolderIcon name={folder.name} icon={icon} preview size={22}/><span>{folderIconLabels[icon]}</span></button>)}</div></fieldset>{validation && <p className="error" role="alert">{validation}</p>}<div className="button-row"><button className="primary">保存文件夹</button><button type="button" onClick={() => { setFolder(null); setValidation(''); }}>取消</button></div></form>}
    <div className="folder-settings-list">{data.folders.map((f, i) => <div key={f.id} className="folder-settings-item">
      <div className="shortcut-row" draggable onDragStart={() => setDrag({ kind: 'folder', id: f.id })} onDragEnd={() => setDrag(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag?.kind === 'folder') edit(d => ({ ...d, folders: moveShortcut(d.folders, d.folders.findIndex(x => x.id === drag.id), i) })); setDrag(null); }}>
        <span className="mini-icon"><FolderIcon name={f.name} icon={f.icon} size={19}/></span><div className="shortcut-info"><strong className="folder-row-name">{f.name}</strong><small>{data.shortcuts.filter(s => s.folderId === f.id).length} 个网站</small></div>
        <div className="row-actions"><button className="icon-button" aria-label={`上移文件夹 ${f.name}`} disabled={i === 0} onClick={() => edit(d => ({ ...d, folders: moveShortcut(d.folders, i, i - 1) }))}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`下移文件夹 ${f.name}`} disabled={i === data.folders.length - 1} onClick={() => edit(d => ({ ...d, folders: moveShortcut(d.folders, i, i + 1) }))}><ArrowDown size={15}/></button><button className="icon-button" aria-label={`重命名文件夹 ${f.name}`} onClick={() => { setFolder(f); setValidation(''); }}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`删除文件夹 ${f.name}`} onClick={() => setDeleting(f.id)}><Trash2 size={15}/></button></div>
      </div>
      {deleting === f.id && <div className="folder-delete" role="group" aria-label={`确认删除 ${f.name}`}><p>网站将移至未分类，网站不会被删除。</p><div className="button-row"><button className="danger" onClick={() => { edit(d => ({ ...d, folders: d.folders.filter(x => x.id !== f.id), shortcuts: d.shortcuts.map(s => s.folderId === f.id ? { ...s, folderId: null } : s) })); if (filter === `folder:${f.id}`) setFilter('all'); if (editing?.folderId === f.id) setEditing({ ...editing, folderId: null }); if (folder?.id === f.id) setFolder(null); setDeleting(null); }}>确定删除文件夹</button><button onClick={() => setDeleting(null)}>取消</button></div></div>}
    </div>)}</div>
    {!data.folders.length && <p className="hint">新建文件夹后，为网站选择归属。未分组的网站显示在“未分类”中。</p>}
    <div className="section-heading divided"><h3>你的常用网站</h3><div className="shortcut-add-actions"><button type="button" className="small" onClick={()=>setPresetOpen(open=>!open)} aria-expanded={presetOpen}>添加常用网站</button><button className="small" disabled={data.shortcuts.length >= 100} onClick={() => { setEditing({ ...fresh(), folderId: activeFilter.startsWith('folder:') ? activeFilter.slice(7) : null }); setValidation(''); }}><Plus size={16}/>添加</button></div></div>
    {presetOpen&&<PresetCatalog data={data} edit={edit} onClose={()=>setPresetOpen(false)}/>}
    <p className="description">拖动捷径调整顺序，也可以使用上下按钮。</p>
    <div className="engine-setting"><span>查看文件夹</span><GlassSelect label="查看文件夹" value={activeFilter} options={filterOptions} onChange={value=>{setFilter(value);setDrag(null);}}/></div>
    {editing && <form className="shortcut-form" onSubmit={saveSite}>
      <label>网站名称<input required maxLength={40} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="例如：我的邮箱"/></label>
      <label>网站地址<input type="url" required value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="https://"/></label>
      <div className="engine-setting"><span>所属文件夹</span><GlassSelect label="所属文件夹" value={data.folders.some(f=>f.id===editing.folderId)?editing.folderId!: ''} options={folderOptions} onChange={value=>setEditing({...editing,folderId:value||null})}/></div>
      {validation && <p className="error" role="alert">{validation}</p>}<div className="button-row"><button className="primary">保存捷径</button><button type="button" onClick={() => { setEditing(null); setValidation(''); }}>取消</button></div>
    </form>}
    <div className="shortcut-list">{visible.map((s, i) => <div className="shortcut-row" key={s.id} draggable onDragStart={() => setDrag({ kind: 'site', id: s.id })} onDragEnd={() => setDrag(null)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag?.kind === 'site') orderSite(visible.findIndex(x => x.id === drag.id), i); setDrag(null); }}>
      <span className="mini-icon"><ShortcutIcon url={s.url} title={s.title}/></span><div className="shortcut-info"><strong>{s.title}</strong><small>{new URL(s.url).hostname} · {data.folders.find(f => f.id === s.folderId)?.name ?? '未分类'}</small></div>
      <div className="row-actions"><button className="icon-button" aria-label={`上移 ${s.title}`} disabled={i === 0} onClick={() => orderSite(i, i - 1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`下移 ${s.title}`} disabled={i === visible.length - 1} onClick={() => orderSite(i, i + 1)}><ArrowDown size={15}/></button><button className="icon-button" aria-label={`编辑 ${s.title}`} onClick={() => { setEditing(s); setValidation(''); }}><Pencil size={15}/></button><button className="icon-button danger" aria-label={`删除 ${s.title}`} onClick={() => { edit(d => ({ ...d, shortcuts: d.shortcuts.filter(x => x.id !== s.id) })); if (editing?.id === s.id) setEditing(null); }}><Trash2 size={15}/></button></div>
    </div>)}</div>
    {!visible.length && <div className="empty">此处暂无网站，添加一个捷径开始使用。</div>}
    <p className="hint">{user ? '更改会自动保存到你的账号。' : '访客更改仅用于当前页面。登录后加载私人捷径。'}</p>
  </>;
}
