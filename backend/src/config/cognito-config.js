import { createRemoteJWKSet, jwtVerify } from 'jose';

const region = process.env.AWS_COGNITO_REGION;
const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
const clientId = process.env.AWS_COGNITO_CLIENT_ID;

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwksUri = `${issuer}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(jwksUri));

/**
 * Verify a Cognito JWT token and return the decoded claims.
 * @param {string} token - The JWT token from the Authorization header
 * @returns {Promise<object>} Decoded token with user claims
 */
export function verifyCognitoToken(token) {
  return jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      issuer,
    }).then(({ payload }) => {
      // Validate audience (ID tokens use 'aud', access tokens use 'client_id')
      if (payload.aud !== clientId && payload.client_id !== clientId) {
        throw new Error('Token was not issued for this client');
      }
      return payload;
    });
}

/**
 * Extract a normalized user object from Cognito token claims.
 */
export function extractUserFromToken(decoded) {
  const email = decoded.email || decoded['cognito:username'];
  const groups = decoded['cognito:groups'] || [];
  const roles = groups.length > 0 ? groups : ['admin']; // default role if no groups

  const givenName = decoded.given_name || '';
  const familyName = decoded.family_name || '';
  const fullName = decoded.name || `${givenName} ${familyName}`.trim() || email;

  return {
    username: email,
    email,
    fullName,
    firstName: givenName,
    lastName: familyName,
    roles,
    cognitoSub: decoded.sub,
    photoURL: decoded.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${(givenName[0] || '')}{${familyName[0] || ''}}`,
  };
}
