import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
export async function accountSql(email,password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱无效');
  if(password.length<12||password.length>128) throw new Error('密码须为 12–128 个字符');
  const id=randomUUID(), account=randomUUID(), now=new Date().toISOString(), hash=await hashPassword(password);
  const q=s=>`'${s.replaceAll("'","''")}'`;
  // UNIQUE email and FK prevent accidental overwriting an existing account.
  return `INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (${q(id)},'BeyondFog',${q(email.toLowerCase())},1,${q(now)},${q(now)});\nINSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (${q(account)},${q(id)},'credential',${q(id)},${q(hash)},${q(now)},${q(now)});`;
}
