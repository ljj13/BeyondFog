import { useState } from 'react';
import { ArrowRight,LockKeyhole } from 'lucide-react';
import { Modal } from './Modal';
import { api } from './api';
export function AuthDialog({onClose,onLogin,token,change=false}:{onClose:()=>void;onLogin:()=>Promise<void>;token?:string;change?:boolean}) {
  const [mode,setMode]=useState<'login'|'forgot'|'reset'|'change'>(token?'reset':change?'change':'login');
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[current,setCurrent]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
  const title={login:'回到你的空间',forgot:'找回密码',reset:'设置新密码',change:'修改密码'}[mode];
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');setSuccess('');
    try {
      if(mode==='login') {await api('/api/auth/sign-in/email','POST',{email,password});await onLogin();onClose();}
      else if(mode==='forgot') {await api('/api/auth/request-password-reset','POST',{email,redirectTo:location.origin});setSuccess('如果邮箱与账号匹配，重置邮件将发送到已验证邮箱。链接在 30 分钟后失效。');}
      else {
        if(password!==confirm)throw new Error('两次密码不一致');
        if(mode==='reset') {await api('/api/auth/reset-password','POST',{token,newPassword:password});history.replaceState(null,'','/');}
        else await api('/api/auth/change-password','POST',{currentPassword:current,newPassword:password,revokeOtherSessions:true});
        setPassword('');setCurrent('');setConfirm('');setSuccess('密码已更新，请使用新密码登录。');if(mode==='change')await api('/api/auth/sign-out','POST',{});await onLogin();setMode('login');
      }
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  return <Modal title={title} onClose={onClose}><div className="auth-intro"><LockKeyhole size={24}/><p>{mode==='login'?'登录后，捷径、偏好和壁纸会跟随你。':mode==='forgot'?'发送重置链接到你的登录邮箱。':'使用至少 12 个字符，给你的空间一把新钥匙。'}</p></div><form onSubmit={submit}>
    {(mode==='login'||mode==='forgot')&&<label>邮箱<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@gmail.com"/></label>}
    {mode==='change'&&<label>当前密码<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
    {mode!=='forgot'&&<label>{mode==='login'?'密码':'新密码'}<input type="password" required minLength={mode==='login'?undefined:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={mode==='login'?'输入密码':'至少 12 个字符'}/></label>}
    {(mode==='change'||mode==='reset')&&<label>确认新密码<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>}
    {error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}
    <button className="primary wide" disabled={busy}>{busy?'处理中…':mode==='login'?'登录':mode==='forgot'?'发送重置邮件':'更新密码'}<ArrowRight size={18}/></button>
  </form>{(mode==='login'||mode==='forgot')&&<button className="text-button" type="button" onClick={()=>{setMode(mode==='login'?'forgot':'login');setError('');}}>{mode==='login'?'忘记密码？':'返回登录'}</button>}<p className="hint">个人空间 · 仅开放管理员账号</p></Modal>;
}
