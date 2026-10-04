import { betterAuth } from 'better-auth';
import type { Env } from './types';
export function createAuth(env: Env) {
  return betterAuth({
    appName: 'BeyondFog', baseURL: env.APP_ORIGIN, basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET, database: env.DB,
    trustedOrigins: [env.APP_ORIGIN],
    emailAndPassword: {
      enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800, revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({user, token}) => {
        if (user.email.toLowerCase() !== env.OWNER_EMAIL.toLowerCase()) return;
        if (!env.EMAIL) throw new Error('EMAIL_NOT_CONFIGURED');
        const link = new URL('/', env.APP_ORIGIN); link.searchParams.set('token', token);
        await env.EMAIL.send({from: {name: 'BeyondFog', email: env.EMAIL_FROM}, to: env.OWNER_EMAIL, subject: '重置 BeyondFog 密码', text: `请在 30 分钟内打开以下链接重置密码。链接只能使用一次。\n\n${link.href}\n\n如果你没有请求重置，请忽略此邮件。`});
      },
    },
    session: {expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: {enabled: false}},
    advanced: {cookiePrefix: 'beyondfog', useSecureCookies: env.APP_ORIGIN.startsWith('https:'), defaultCookieAttributes: {httpOnly: true, sameSite: 'lax'}},
    // Durable Object performs persistent limits before dispatch; silence auth logs so tokens/passwords never reach logs.
    rateLimit: {enabled: false}, logger: {disabled: true},
  });
}
