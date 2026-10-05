import { preferencesSchema, type Preferences, type FolderIconName } from './preferences';

export type PresetSite={id:string;title:string;url:string;hosts:readonly string[];subdomains?:boolean};
type Category={id:string;name:string;icon:FolderIconName;sites:PresetSite[]};
const site=(id:string,title:string,url:string,hosts=[new URL(url).hostname],subdomains=false):PresetSite=>({id,title,url,hosts,subdomains});
export const presetCategories:Category[]=[
  {id:'email',name:'邮箱',icon:'mail',sites:[site('gmail','Gmail','https://mail.google.com/'),site('outlook','Outlook','https://outlook.live.com/mail/',['outlook.live.com','outlook.office.com','outlook.office365.com']),site('qq-mail','QQ 邮箱','https://mail.qq.com/',['mail.qq.com','wx.mail.qq.com']),site('163-mail','163 邮箱','https://mail.163.com/')]},
  {id:'work',name:'工作',icon:'briefcase',sites:[site('github','GitHub','https://github.com/'),site('cloudflare','Cloudflare','https://dash.cloudflare.com/',['dash.cloudflare.com','cloudflare.com','www.cloudflare.com']),site('notion','Notion','https://www.notion.so/',['www.notion.so','notion.so','www.notion.com','notion.com'])]},
  {id:'learning',name:'学习',icon:'book',sites:[site('wikipedia','维基百科','https://zh.wikipedia.org/',['wikipedia.org'],true),site('mdn','MDN','https://developer.mozilla.org/zh-CN/'),site('mooc','中国大学 MOOC','https://www.icourse163.org/',['www.icourse163.org','icourse163.org'])]},
  {id:'shopping',name:'购物',icon:'shopping',sites:[site('jd','京东','https://www.jd.com/',['jd.com'],true),site('taobao','淘宝','https://www.taobao.com/',['www.taobao.com','taobao.com']),site('tmall','天猫','https://www.tmall.com/',['www.tmall.com','tmall.com'])]},
  {id:'entertainment',name:'娱乐',icon:'play',sites:[site('bilibili','哔哩哔哩','https://www.bilibili.com/',['www.bilibili.com','bilibili.com']),site('youtube','YouTube','https://www.youtube.com/',['www.youtube.com','youtube.com','m.youtube.com']),site('netease-music','网易云音乐','https://music.163.com/')]},
  {id:'tools',name:'工具',icon:'tools',sites:[site('deepl','DeepL','https://www.deepl.com/translator',['www.deepl.com','deepl.com']),site('baidu-drive','百度网盘','https://pan.baidu.com/'),site('docs-qq','腾讯文档','https://docs.qq.com/')]},
];
export function matchingShortcuts(data:Preferences,preset:PresetSite) {
  return data.shortcuts.filter(s=>{
    const hostname=new URL(s.url).hostname;
    return preset.hosts.some(host=>hostname===host || (preset.subdomains&&hostname.endsWith(`.${host}`)));
  });
}
export function buildPresetImport(data:Preferences,selected:readonly string[],makeId=()=>crypto.randomUUID()) {
  const chosen=new Set(selected),folders=[...data.folders];let shortcuts=[...data.shortcuts],added=0,moved=0,created=0;
  for(const category of presetCategories){
    for(const preset of category.sites){
      if(!chosen.has(preset.id))continue;
      const matches=matchingShortcuts({...data,shortcuts},preset),ungrouped=matches.filter(s=>s.folderId===null);
      if(matches.length&&!ungrouped.length)continue;
      let folder=folders.find(f=>f.name===category.name);
      if(!folder){folder={id:makeId(),name:category.name,icon:category.icon};folders.push(folder);created++;}
      if(!matches.length){shortcuts.push({id:makeId(),title:preset.title,url:preset.url,folderId:folder.id});added++;}
      else {const ids=new Set(ungrouped.map(s=>s.id));shortcuts=shortcuts.map(s=>ids.has(s.id)?{...s,folderId:folder.id}:s);moved+=ids.size;}
    }
  }
  if(shortcuts.length>100)throw new Error(`网站最多 100 个，所选操作将达到 ${shortcuts.length} 个，请减少勾选。`);
  if(folders.length>20)throw new Error(`文件夹最多 20 个，所选操作将达到 ${folders.length} 个，请减少勾选。`);
  return {data:added||moved?preferencesSchema.parse({...data,folders,shortcuts}):data,added,moved,created};
}
