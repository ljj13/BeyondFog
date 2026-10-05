import type { FolderIconName } from './preferences';

export const folderIconLabels: Record<FolderIconName,string> = {
  auto:'自动',folder:'文件夹',mail:'信封',briefcase:'公文包',book:'书本',shopping:'购物袋',play:'播放',tools:'工具',code:'代码',star:'星标',heart:'爱心',
};
export function resolveFolderIcon(name:string,icon:FolderIconName='auto'):Exclude<FolderIconName,'auto'> {
  if(icon!=='auto')return icon;
  if(/邮箱|邮件/.test(name))return 'mail';
  if(/工作|办公/.test(name))return 'briefcase';
  if(/学习|阅读/.test(name))return 'book';
  if(/购物|商城/.test(name))return 'shopping';
  if(/娱乐|视频/.test(name))return 'play';
  if(/工具/.test(name))return 'tools';
  return 'folder';
}
