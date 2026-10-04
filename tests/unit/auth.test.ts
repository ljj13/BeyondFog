import { beforeEach,afterEach,it,expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { hashPassword } from 'better-auth/crypto';
import { createAuth } from '../../worker/auth';
import type { Env } from '../../worker/types';

// Real SQLite behind the minimal native D1 binding protocol: no mocked auth behavior.
let db:DatabaseSync,auth:ReturnType<typeof createAuth>,mails:EmailMessageBuilder[];
const origin='https://home.example.com',password='BeyondFog-test-password-2026';
function prepare(sql:string,parameters:any[]=[]):any {
  return {bind(...args:any[]){return prepare(sql,args);},async all(){const statement=db.prepare(sql);const results=statement.all(...parameters);return {results,meta:{changes:results.length,last_row_id:0},success:true};},async run(){const result=db.prepare(sql).run(...parameters);return {results:[],meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)},success:true};},async first(){return db.prepare(sql).get(...parameters)??null;}};
}
beforeEach(async()=>{
  db=new DatabaseSync(':memory:');db.exec(readFileSync('migrations/0001_initial.sql','utf8'));
  const now=new Date().toISOString();db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,?,?,?)').run('owner','Owner','owner@example.com',1,now,now);
  db.prepare('INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run('account','owner','credential','owner',await hashPassword(password),now,now);
  mails=[];
  auth=createAuth({APP_ORIGIN:origin,OWNER_EMAIL:'owner@example.com',BETTER_AUTH_SECRET:'Test-only-auth-secret-with-more-than-32-characters',DB:{prepare,exec:(sql:string)=>db.exec(sql),batch:async(statements:any[])=>Promise.all(statements.map(s=>s.all()))},EMAIL_FROM:'noreply@home.example.com',EMAIL:{send:async(m:EmailMessageBuilder)=>{mails.push(m);return{};}}} as unknown as Env);
});
afterEach(()=>db.close());
function call(path:string,body?:unknown,cookie='') {return auth.handler(new Request(origin+'/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined}));}
it('uses secure HttpOnly cookies and does not accept invalid credentials',async()=>{
  expect((await call('sign-in/email',{email:'owner@example.com',password:'bad'})).status).toBe(401);
  const login=await call('sign-in/email',{email:'owner@example.com',password});
  expect(login.status).toBe(200);const cookie=login.headers.get('set-cookie')!;
  expect(cookie).toContain('Secure');expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Lax');
});
it('closed public signup does not create accounts',async()=>{
  expect((await call('sign-up/email',{email:'intruder@example.com',password,name:'x'})).status).toBe(400);
  expect(db.prepare('SELECT count(*) AS n FROM user').get()!.n).toBe(1);
});
it('reset is scoped to owner, lasts 30 minutes, can be consumed once and revokes every session',async()=>{
  const login=await call('sign-in/email',{email:'owner@example.com',password});
  const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  expect(await (await call('get-session',undefined,cookie)).json()).not.toBeNull();
  expect((await call('request-password-reset',{email:'missing@example.com'})).status).toBe(200);expect(mails).toHaveLength(0);
  const start=Date.now();expect((await call('request-password-reset',{email:'owner@example.com'})).status).toBe(200);
  expect(mails).toHaveLength(1);expect(mails[0].to).toBe('owner@example.com');
  const link=(mails[0].text as string).match(/https:\/\/[^\s]+/)![0],token=new URL(link).searchParams.get('token');
  const expiry=Date.parse(db.prepare('SELECT expiresAt FROM verification').get()!.expiresAt as string);
  expect(expiry-start).toBeGreaterThan(1790000);expect(expiry-start).toBeLessThan(1810000);
  const body={token,newPassword:'A-new-test-password-2026'};
  expect((await call('reset-password',body)).status).toBe(200);
  expect((await call('reset-password',body)).status).toBe(400);
  expect(await (await call('get-session',undefined,cookie)).json()).toBeNull();
  expect((await call('sign-in/email',{email:'owner@example.com',password})).status).toBe(401);
  expect((await call('sign-in/email',{email:'owner@example.com',password:body.newPassword})).status).toBe(200);
});
it('expired reset tokens and expired sessions cannot be used',async()=>{
  const login=await call('sign-in/email',{email:'owner@example.com',password});const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  db.prepare('UPDATE session SET expiresAt=?').run(new Date(Date.now()-60000).toISOString());
  expect(await (await call('get-session',undefined,cookie)).json()).toBeNull();
  await call('request-password-reset',{email:'owner@example.com'});
  const token=new URL(mails[0].text!.match(/https:\/\/[^\s]+/)![0]).searchParams.get('token');
  db.prepare('UPDATE verification SET expiresAt=?').run(new Date(Date.now()-60000).toISOString());
  expect((await call('reset-password',{token,newPassword:password})).status).toBe(400);
});
it('two simultaneous uses of a reset token have exactly one winner',async()=>{
  await call('request-password-reset',{email:'owner@example.com'});const token=new URL(mails[0].text!.match(/https:\/\/[^\s]+/)![0]).searchParams.get('token');
  const results=await Promise.all([call('reset-password',{token,newPassword:password}),call('reset-password',{token,newPassword:password})]);
  expect(results.map(r=>r.status).sort()).toEqual([200,400]);
});
