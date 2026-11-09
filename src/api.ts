export class ApiError extends Error {
  constructor(public status:number,message:string,public payload?:any) {super(message);}
}
const TIMEOUT=25_000;
export async function api<T=any>(path:string,method='GET',body?:unknown,signal?:AbortSignal):Promise<T> {
  // Stalled requests would otherwise leave the save chain (and the logout button) waiting forever.
  const timeout=AbortSignal.timeout(TIMEOUT);
  let r:Response;
  try {
    r=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:signal?AbortSignal.any([signal,timeout]):timeout,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  } catch(e) {
    // Callers abort deliberately; only a stall of the timeout signal is a failure worth explaining.
    if(timeout.aborted) throw new ApiError(0,'网络响应超时，请检查连接后重试');
    throw e;
  }
  const value=await r.json().catch(()=>null) as any;
  if(!r.ok) {
    const codes:Record<string,string>={INVALID_EMAIL_OR_PASSWORD:'邮箱或密码错误',INVALID_PASSWORD:'当前密码错误',INVALID_TOKEN:'链接已失效或已被使用，请重新申请',PASSWORD_TOO_SHORT:'密码至少 12 个字符',PASSWORD_TOO_LONG:'密码最多 128 个字符',SESSION_EXPIRED:'会话已过期，请重新登录'};
    throw new ApiError(r.status,value?.error ?? codes[value?.code] ?? (r.status===429?'操作过于频繁，请稍后再试':r.status===401?'请重新登录':'操作失败，请稍后重试'),value);
  }
  return value;
}
