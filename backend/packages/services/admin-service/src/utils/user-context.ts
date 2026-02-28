import type { APIGatewayProxyEvent } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';
import type { UUID } from '@ams/types';

/**
 * Resolve Cognito `sub` -> users.user_id, provisioning the user in the app DB if needed.
 *
 * This avoids the common bug where handlers incorrectly treat the Cognito `sub`
 * as the DB `user_id`, which can break foreign keys/audit trails and cause auth loops.
 */
export async function getUserContext(
  event: APIGatewayProxyEvent
): Promise<{ authSub?: string; userId?: UUID }> {
  const claims = event.requestContext.authorizer?.['claims'] as Record<string, string> | undefined;
  const authSub = claims?.['sub'];

  if (!authSub) {
    // Unauthenticated request (or authorizer missing) - callers should return 401.
    return { authSub: undefined, userId: undefined };
  }

  const userId =
    (await resolveUserIdFromAuthId(authSub)) ??
    (await ensureUserIdFromAuthClaims({
      sub: authSub,
      email: claims?.['email'],
      givenName: claims?.['given_name'],
      familyName: claims?.['family_name'],
    }));

  return { authSub, userId: userId as UUID | undefined };
}
