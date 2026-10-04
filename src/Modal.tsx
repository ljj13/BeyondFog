import { useEffect,useRef,type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({title,children,onClose,panel=false}:{title:string;children:ReactNode;onClose:()=>void;panel?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const node=ref.current!;
    const elements=()=>[...node.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]')].filter(e=>!e.hasAttribute('disabled')&&e.getClientRects().length>0);
    elements()[0]?.focus();
    const handler=(e:KeyboardEvent)=>{
      if(e.key==='Escape') {e.preventDefault();onClose();}
      if(e.key==='Tab') {const all=elements(),first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    };
    document.addEventListener('keydown',handler);const old=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=old;previous?.focus();};
  },[onClose]);
  return <div className={`scrim ${panel?'panel-scrim':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={panel?'panel':'modal'}><header className="dialog-header"><div><span className="eyebrow">BEYONDFOG</span><h2>{title}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={`关闭${title}`}><X size={21}/></button></header>{children}</div></div>;
}
