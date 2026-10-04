import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { engines, type Preferences } from './shared/preferences';

type Engine = Preferences['engine'];
const choices = Object.entries(engines) as [Engine, string][];

export function EnginePicker({ value, onChange, label, variant = 'settings' }: {
  value: Engine;
  onChange: (engine: Engine) => void;
  label: string;
  variant?: 'search' | 'settings';
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ above: false, left: 0, width: 160, maxHeight: 200 });
  const selected = choices.findIndex(([engine]) => engine === value);

  function show(index = selected) { setActive(index); setOpen(true); }
  function confirm(index = active) {
    if (choices[index][0] !== value) onChange(choices[index][0]);
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor = root.current!.getBoundingClientRect();
      const container = root.current!.closest('.panel-content')?.getBoundingClientRect();
      const top = Math.max(8, (container?.top ?? 0) + 8);
      const bottom = Math.min(innerHeight - 8, (container?.bottom ?? innerHeight) - 8);
      const left = Math.max(8, (container?.left ?? 0) + 8);
      const right = Math.min(innerWidth - 8, (container?.right ?? innerWidth) - 8);
      if (anchor.bottom < top || anchor.top > bottom) { setOpen(false); return; }
      const height = menu.current!.scrollHeight + 2;
      const below = Math.max(0, bottom - anchor.bottom - 8);
      const aboveSpace = Math.max(0, anchor.top - top - 8);
      const above = below < height && aboveSpace > below;
      const width = Math.min(variant === 'search' ? 160 : anchor.width, right - left);
      setPosition({ above, width, maxHeight: above ? aboveSpace : below,
        left: Math.min(Math.max(anchor.left, left), right - width) - anchor.left });
    }
    function outside(e: PointerEvent) {
      if (!root.current!.contains(e.target as Node)) setOpen(false);
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, variant]);

  useLayoutEffect(() => {
    if (open) menu.current?.querySelectorAll<HTMLElement>('[role="option"]')[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function keyboard(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Escape' && open) {
      e.preventDefault(); e.stopPropagation(); setOpen(false); return;
    }
    if (e.key === 'Tab') { if (open) confirm(); return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Enter' || e.key === ' ') { if (open) confirm(); else show(); }
      else if (e.key === 'Home' || e.key === 'End') show(e.key === 'Home' ? 0 : choices.length - 1);
      else if (!open) show();
      else setActive(index => Math.max(0, Math.min(choices.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1))));
    }
  }

  return <div className={`engine-picker engine-picker-${variant}`} ref={root}>
    <button ref={trigger} type="button" className="engine-trigger" role="combobox"
      aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open ? `${id}-${choices[active][0]}` : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={keyboard}
      onBlur={() => setOpen(false)}>
      <span>{engines[value]}</span><ChevronDown size={14} aria-hidden="true" className={open ? 'expanded' : ''}/>
    </button>
    {open && <div ref={menu} id={`${id}-list`} role="listbox" aria-label={label}
      className={`engine-menu ${position.above ? 'engine-menu-above' : ''}`}
      style={{ left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      {choices.map(([engine, name], index) => <div key={engine} id={`${id}-${engine}`} role="option"
        aria-selected={engine === value} className={`engine-option ${index === active ? 'engine-option-active' : ''}`}
        onPointerMove={e => { if (e.pointerType !== 'touch') setActive(index); }}
        onPointerDown={e => e.preventDefault()}
        onClick={() => { confirm(index); trigger.current?.focus(); }}>
        <span>{name}</span>{engine === value && <Check size={16} aria-hidden="true"/>}
      </div>)}
    </div>}
  </div>;
}
