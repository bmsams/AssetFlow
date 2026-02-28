import { queryOne } from './pool';

/**
 * Resolve an authentication identifier to users.user_id.
 * Accepts either a users.user_id value or a Cognito sub.
 */
export async function resolveUserIdFromAuthId(
  authId: string | undefined | null
): Promise<string | undefined> {
  if (!authId) {
    return undefined;
  }

  const result = await queryOne<{ userId: string }>(
    `SELECT user_id as "userId"
     FROM users
     WHERE user_id::text = $1 OR cognito_sub = $1
     LIMIT 1`,
    [authId]
  );

  return result?.userId;
}

export interface AuthClaimsForProvisioning {
  sub: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

/**
 * Ensure a Cognito-authenticated user exists in the app DB and return users.user_id.
 *
 * This is intentionally minimal for dev environments: it only provisions the core
 * user record (users) so downstream handlers can map Cognito `sub` -> `user_id`.
 *
 * If we can't provision (e.g. email missing), returns undefined.
 */
export async function ensureUserIdFromAuthClaims(
  claims: AuthClaimsForProvisioning | undefined | null
): Promise<string | undefined> {
  const sub = claims?.sub;
  if (!sub) return undefined;

  const existing = await resolveUserIdFromAuthId(sub);
  if (existing) return existing;

  const email = claims?.email ?? undefined;
  if (!email) return undefined;

  // Prefer conflict resolution by email since Cognito `sub` can differ across pools.
  const result = await queryOne<{ userId: string }>(
    `INSERT INTO users (cognito_sub, email, first_name, last_name, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       cognito_sub = EXCLUDED.cognito_sub,
       first_name = COALESCE(EXCLUDED.first_name, users.first_name),
       last_name = COALESCE(EXCLUDED.last_name, users.last_name),
       is_active = TRUE,
       updated_at = NOW()
     RETURNING user_id as "userId"`,
    [sub, email, claims?.givenName ?? null, claims?.familyName ?? null]
  );

  return result?.userId;
}
