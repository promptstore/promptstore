import axios from 'axios';
import { createPublicKey } from 'crypto';
import jwt from 'jsonwebtoken';

const region = process.env.AWS_COGNITO_REGION;
const userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
const clientId = process.env.AWS_COGNITO_CLIENT_ID;

const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
const jwksUri = `${issuer}/.well-known/jwks.json`;
const JWKS_CACHE_MAX_AGE_MS = 600000;

let cachedJwks = null;
let cachedJwksExpiresAt = 0;

async function getJwks() {
  if (cachedJwks && Date.now() < cachedJwksExpiresAt) {
    return cachedJwks;
  }

  const { data } = await axios.get(jwksUri);
  cachedJwks = createLocalJWKSet(data);
  cachedJwksExpiresAt = Date.now() + JWKS_CACHE_MAX_AGE_MS;
  return cachedJwks;
}

async function getPublicKey(kid) {
  const jwks = await getJwks();
  const jwk = jwks.keys?.find((key) => key.kid === kid);

  if (!jwk) {
    throw new Error(`Unable to find signing key for kid: ${kid}`);
  }

  return createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * Verify a Cognito JWT token and return the decoded claims.
 * @param {string} token - The JWT token from the Authorization header
 * @returns {Promise<object>} Decoded token with user claims
 */
export function verifyCognitoToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded?.header?.kid;

  if (!kid) {
    return Promise.reject(new Error('Token is missing kid header'));
  }

  return getPublicKey(kid).then((publicKey) => new Promise((resolve, reject) => {
    jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
    }, (err, payload) => {
      if (err) {
        reject(err);
        return;
      }

      // Validate audience (ID tokens use 'aud', access tokens use 'client_id')
      if (payload.aud !== clientId && payload.client_id !== clientId) {
        reject(new Error('Token was not issued for this client'));
        return;
      }

      resolve(payload);
    });
  }));
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
