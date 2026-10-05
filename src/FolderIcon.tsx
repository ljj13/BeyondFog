import { Folder, Mail, BriefcaseBusiness, BookOpen, ShoppingBag, Play, Wrench, Code, Star, Heart, Sparkles } from 'lucide-react';
import { resolveFolderIcon } from './shared/folder-icons';
import type { FolderIconName } from './shared/preferences';

const icons={folder:Folder,mail:Mail,briefcase:BriefcaseBusiness,book:BookOpen,shopping:ShoppingBag,play:Play,tools:Wrench,code:Code,star:Star,heart:Heart};
export function FolderIcon({name='',icon='auto',size=24,preview=false}:{name?:string;icon?:FolderIconName;size?:number;preview?:boolean}){
  const key=resolveFolderIcon(name,icon),Component=preview&&icon==='auto'?Sparkles:icons[key];
  return <Component size={size} strokeWidth={1.5} data-folder-icon={key} aria-hidden="true"/>;
}
