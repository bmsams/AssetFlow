import type { APIGatewayProxyEvent } from 'aws-lambda';

import { ensureUserIdFromAuthClaims, resolveUserIdFromAuthId } from '@ams/database';

export async function getUserContext(
  event: APIGatewayProxyEvent
): Promise<{ authSub?: string; userId?: string }> {
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

  return { authSub, userId };
}
