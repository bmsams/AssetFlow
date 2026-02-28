import type { Page } from 'playwright/test';

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'none', typ: 'JWT' };
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.`;
}

export async function setTestAuth(
  page: Page,
  roles: string[] = ['admin']
): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  const token = makeUnsignedJwt({
    sub: 'e2e-user',
    email: 'e2e@example.com',
    email_verified: true,
    name: 'E2E User',
    exp,
    'cognito:groups': roles,
  });

  await page.addInitScript(({ token: t }) => {
    // NOTE: this app stores both access+id token under the same key ("ams_id_token").
    localStorage.setItem('ams_id_token', t);
  }, { token });
}

