import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
export type SelectOption<T extends string> = {value:T;label:string;icon?:ReactNode;detail?:string};

export function GlassSelect<T extends string>({ value, options, onChange, label, variant = 'settings' }: {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  variant?: 'search' | 'settings';
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuPointer = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ above: false, left: 0, width: 160, maxHeight: 200 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const keys = options.map(option => option.value).join('\0');

  function show(index = selected) { if (!options.length) return; setActive(index); setOpen(true); }
  function confirm(index = active) {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = root.current!.getBoundingClientRect();
      const container = root.current!.closest('.panel-content')?.getBoundingClientRect();
      const vv=window.visualViewport, x=vv?.offsetLeft??0, y=vv?.offsetTop??0;
      const rightEdge=x+(vv?.width??innerWidth),bottomEdge=y+(vv?.height??innerHeight);
      const zoom=(root.current as HTMLElement & {currentCSSZoom?:number}).currentCSSZoom ?? (Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1);
      const top = Math.max(y+8, (container?.top ?? y) + 8);
      const bottom = Math.min(bottomEdge - 8, (container?.bottom ?? bottomEdge) - 8);
      const left = Math.max(x+8, (container?.left ?? x) + 8);
      const right = Math.min(rightEdge - 8, (container?.right ?? rightEdge) - 8);
      if (anchor.bottom < top || anchor.top > bottom) { setOpen(false); return; }
      const height = Math.min(320, menu.current!.scrollHeight + 2)*zoom;
      const below = Math.max(0, bottom - anchor.bottom - 8);
      const aboveSpace = Math.max(0, anchor.top - top - 8);
      const above = below < height && aboveSpace > below;
      const width = Math.min(variant === 'search' ? 160*zoom : anchor.width, right - left);
      setPosition({ above, width:width/zoom, maxHeight: Math.max(0,Math.min(320,(above ? aboveSpace : below)/zoom)),
        left: (Math.min(Math.max(anchor.left, left), right - width) - anchor.left)/zoom });
    }
    function outside(e: PointerEvent) {
      if (!root.current!.contains(e.target as Node)) { menuPointer.current = false; setOpen(false); }
    }
    function releaseMenuPointer() {
      if (!menuPointer.current) return;
      menuPointer.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
    setActive(index=>Math.min(Math.max(0,index),options.length-1));
    place();
    const observer=new ResizeObserver(place);observer.observe(root.current!);observer.observe(menu.current!);
    window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('pointerup', releaseMenuPointer);
    document.addEventListener('pointercancel', releaseMenuPointer);
    return () => {
      observer.disconnect();window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('pointerup', releaseMenuPointer);
      document.removeEventListener('pointercancel', releaseMenuPointer);
      menuPointer.current = false;
    };
  }, [open, variant, keys]);

  useLayoutEffect(() => {
    if (!open) return;
    const scroller = menu.current;
    const option = scroller?.querySelectorAll<HTMLElement>('[role="option"]')[active];
    if (!scroller || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    // Scroll only the popup: scrollIntoView can move the containing settings panel.
    if (top < scroller.scrollTop || option.offsetHeight > scroller.clientHeight) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
  }, [open, active, position.maxHeight]);

  function keyboard(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape' && open) {
      e.preventDefault(); e.stopPropagation(); setOpen(false); return;
    }
    if (e.key === 'Tab') { if (open) confirm(); return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Enter' || e.key === ' ') { if (open) confirm(); else show(); }
      else if (e.key === 'Home' || e.key === 'End') show(e.key === 'Home' ? 0 : options.length - 1);
      else if (!open) show();
      else setActive(index => Math.max(0, Math.min(options.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))));
    }
  }

  return <div className={`engine-picker engine-picker-${variant}`} ref={root}>
    <button ref={trigger} type="button" className="engine-trigger" role="combobox"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open ? `${id}-${options[active]?.value}` : undefined}
      disabled={!options.length} onClick={() => open ? setOpen(false) : show()} onKeyDown={keyboard}
      onBlur={() => { if (!menuPointer.current) setOpen(false); }}>
      <span className="select-value">{options[selected]?.icon}<span>{options[selected]?.label??'请选择'}</span>{options[selected]?.detail&&<small aria-hidden="true">{options[selected].detail}</small>}</span><ChevronDown size={14} aria-hidden="true" className={open ? 'expanded' : ''}/>
    </button>
    {open && <div ref={menu} id={`${id}-list`} role="listbox" aria-label={label}
      className={`engine-menu ${position.above ? 'engine-menu-above' : ''}`}
      onPointerDown={() => { menuPointer.current = true; }}
      style={{ left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${option.value}`} aria-label={option.label} aria-description={option.detail} role="option"
        aria-selected={option.value === value} className={`engine-option ${index === active ? 'engine-option-active' : ''}`}
        onPointerMove={e => { if (e.pointerType !== 'touch') setActive(index); }}
        onPointerDown={e => e.preventDefault()}
        onClick={() => { confirm(index); trigger.current?.focus(); }}>
        <span className="select-option-content">{option.icon}<span>{option.label}</span>{option.detail&&<small aria-hidden="true">{option.detail}</small>}</span>{option.value === value && <Check size={16} aria-hidden="true"/>}
      </div>)}
    </div>}
  </div>;
}
