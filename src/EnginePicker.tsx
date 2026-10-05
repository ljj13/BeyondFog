import { GlassSelect } from './GlassSelect';
import { engines, type Preferences } from './shared/preferences';
const options=Object.entries(engines).map(([value,label])=>({value:value as Preferences['engine'],label}));
export function EnginePicker({value,onChange,label,variant='settings'}:{value:Preferences['engine'];onChange:(value:Preferences['engine'])=>void;label:string;variant?:'search'|'settings'}){
  return <GlassSelect value={value} options={options} onChange={onChange} label={label} variant={variant}/>;
}
