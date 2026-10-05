import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Folder, FolderOpen, Plus } from 'lucide-react';
import { ShortcutIcon } from './ShortcutIcon';
import { moveShortcut, type Preferences } from './shared/preferences';

export function FolderShortcuts({ data, edit, enabled, onAdd }: {
  data: Preferences; edit: (fn: (d: Preferences) => Preferences) => void;
  enabled: boolean; onAdd: (folderId: string | null, folderOnly?: boolean) => void;
}) {
  const [open, setOpen] = useState<string | null>(null), [closing, setClosing] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; width: number; height: number; up: boolean }>();
  const [drag, setDrag] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), popup = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearTimers = useCallback(() => { clearTimeout(openTimer.current); clearTimeout(leaveTimer.current); clearTimeout(fadeTimer.current); }, []);
  const close = useCallback((immediate = false) => {
    clearTimers();
    if (immediate) { setOpen(null); setClosing(false); setPosition(undefined); }
    else { setClosing(true); fadeTimer.current = setTimeout(() => { setOpen(null); setClosing(false); setPosition(undefined); }, 120); }
  }, [clearTimers]);
  const show = (key: string) => { if (!enabled || drag) return; clearTimers(); if (key !== open) setPosition(undefined); setClosing(false); setOpen(key); };
  const groups = data.folders.map(f => ({ key: `folder:${f.id}`, id: f.id as string | null, name: f.name, sites: data.shortcuts.filter(s => s.folderId === f.id) }));
  const unclassified = data.shortcuts.filter(s => s.folderId === null);
  if (unclassified.length) groups.push({ key: 'unclassified', id: null, name: '未分类', sites: unclassified });
  const selected = groups.find(g => g.key === open);
  useEffect(() => () => clearTimers(), [clearTimers]);
  useEffect(() => { if (!enabled || (open && !selected)) close(true); }, [enabled, open, Boolean(selected), close]);
  useEffect(() => {
    if (!open || closing) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const focus = (e: FocusEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); buttons.current.get(open)?.focus({ preventScroll: true }); close(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('focusin', focus); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focus); document.removeEventListener('keydown', escape); };
  }, [open, closing, close]);
  useLayoutEffect(() => {
    if (!open || !selected) return;
    const place = () => {
      const button = buttons.current.get(open), node = popup.current; if (!button || !node) return;
      const rect = button.getBoundingClientRect(), vv = window.visualViewport;
      const x = vv?.offsetLeft ?? 0, y = vv?.offsetTop ?? 0, vw = vv?.width ?? innerWidth, vh = vv?.height ?? innerHeight;
      // Rectangles use viewport pixels; fixed styles and scroll sizes use CSS pixels.
      const zoom = (node as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? (Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1);
      const width = Math.min(360 * zoom, vw - 24), below = y + vh - rect.bottom - 22, above = rect.top - y - 22;
      const contentHeight = ((node.querySelector('header')?.offsetHeight ?? 0) + (node.querySelector('.folder-popup-scroll')?.scrollHeight ?? 0) + 2) * zoom;
      const desired = Math.min(320 * zoom, contentHeight), up = below < desired && above > below;
      const height = Math.min(vh - 24, Math.max(60, Math.min(320 * zoom, up ? above : below)));
      const actualHeight = Math.min(contentHeight, height);
      const top = Math.max(y + 12, Math.min(up ? rect.top - 10 - actualHeight : rect.bottom + 10, y + vh - actualHeight - 12));
      const next = { left: Math.max(x + 12, Math.min(rect.left, x + vw - width - 12)) / zoom, top: top / zoom, width: width / zoom, height: height / zoom, up };
      setPosition(old => old && Object.keys(next).every(k => old[k as keyof typeof old] === next[k as keyof typeof next]) ? old : next);
    };
    place(); const observer = new ResizeObserver(place); if (popup.current) observer.observe(popup.current);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); };
  }, [open, selected?.sites.length, selected?.name]);
  function enter(key: string, type: string) {
    if (type === 'touch' || !enabled || drag) return;
    clearTimeout(leaveTimer.current);
    if (key === open && !closing) return;
    clearTimeout(openTimer.current); openTimer.current = setTimeout(() => { if (!popup.current?.contains(document.activeElement)) show(key); }, 120);
  }
  function leave(type: string) {
    if (type === 'touch') return; clearTimeout(openTimer.current); clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => { if (!popup.current?.contains(document.activeElement)) close(); }, 250);
  }
  return <div className="shortcut-grid folder-grid" ref={root}>
    {groups.map(g => <div key={g.key} className="shortcut-item folder-item" onPointerEnter={e => enter(g.key, e.pointerType)} onPointerLeave={e => leave(e.pointerType)}
      draggable={g.id !== null} onDragStart={() => { if (g.id !== null) { close(true); setDrag(g.id); } }} onDragEnd={() => setDrag(null)} onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); if (drag && g.id !== null) edit(d => ({ ...d, folders: moveShortcut(d.folders, d.folders.findIndex(f => f.id === drag), d.folders.findIndex(f => f.id === g.id)) })); setDrag(null); }}>
      <button ref={node => { if (node) buttons.current.set(g.key, node); else buttons.current.delete(g.key); }} className="folder-trigger shortcut-link" type="button" aria-label={`文件夹 ${g.name}`} aria-expanded={open === g.key && !closing} aria-controls={open === g.key ? 'folder-popup' : undefined}
        onClick={() => open === g.key && !closing ? close() : show(g.key)}>
        <span className="shortcut-icon">{open === g.key && !closing ? <FolderOpen size={28} strokeWidth={1.5}/> : <Folder size={28} strokeWidth={1.5}/>}<span className="folder-count">{g.sites.length}</span></span><span>{g.name}</span>
      </button>
      {open === g.key && <div ref={popup} id="folder-popup" role="region" aria-label={`${g.name}中的网站`} aria-hidden={closing || undefined} inert={closing} className={`folder-popup${closing ? ' is-closing' : ''}`} data-direction={position?.up ? 'up' : 'down'}
        style={{ left: position?.left ?? 0, top: position?.top ?? 0, width: position?.width ?? 360, maxHeight: position?.height ?? 320, visibility: position ? 'visible' : 'hidden', '--folder-shift': position?.up ? '-6px' : '6px' } as CSSProperties}>
        <header className="folder-popup-header"><strong>{g.name}</strong><span>{g.sites.length} 个网站</span></header>
        <div className="folder-popup-scroll"><div className="folder-popup-sites">{g.sites.map(s => <a key={s.id} className="shortcut-link" href={s.url} target="_blank" rel="noreferrer"><span className="shortcut-icon"><ShortcutIcon url={s.url} title={s.title}/></span><span>{s.title}</span></a>)}</div>
          {!g.sites.length && <p className="folder-empty">暂无网站</p>}
          <button className="folder-add-site" disabled={data.shortcuts.length >= 100} onClick={() => { buttons.current.get(g.key)?.focus({ preventScroll: true }); close(true); onAdd(g.id); }}><Plus size={15}/>添加网站</button>
        </div>
      </div>}
    </div>)}
    <button className="add-shortcut" aria-label="添加文件夹" disabled={data.folders.length >= 20} onClick={() => { close(true); onAdd(null, true); }}><span className="shortcut-icon"><Plus size={24} strokeWidth={1.5}/></span><span>添加文件夹</span></button>
  </div>;
}
