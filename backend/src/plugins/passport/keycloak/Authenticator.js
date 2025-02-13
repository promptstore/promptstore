import KeycloakBearerStrategy from 'passport-keycloak-bearer';
import axios from 'axios';

import Strategy from './Strategy';

function Authenticator({ __name, constants, logger, app, passport, usersService }) {

  app.get('/login', (req, res, next) => {
    login(req, res, next);
  });

  app.get('/api/auth/keycloak/return', (req, res, next) => {
    login(req, res, next, (err, user, info) => {
      if (err) {
        let message;
        if (err instanceof Error) {
          message = err.message;
          if (err.stack) {
            message += '\n' + err.stack;
          }
        } else {
          message = err.toString();
        }
        logger.error(message);
        return next(err);
      }
      if (!user) {
        return res.redirect('/login');
      }
      req.logIn(user, (err) => {
        if (err) {
          let message;
          if (err instanceof Error) {
            message = err.message;
            if (err.stack) {
              message += '\n' + err.stack;
            }
          } else {
            message = err.toString();
          }
          logger.error(message);
          return next(err);
        }
        let returnTo = req.session.returnTo;
        if (!returnTo || returnTo === '/') {
          returnTo = '/home';
        }
        delete req.session.returnTo;
        res.redirect(returnTo);
      });
    });
  });

  app.post('/api/auth/refresh', async (req, res, next) => {
    const { refreshToken } = req.body;
    const host = constants.KEYCLOAK_HOST;
    const realm = constants.KEYCLOAK_REALM;
    const url = `${host}/realms/${realm}/protocol/openid-connect/token`;
    const clientId = constants.KEYCLOAK_CLIENT_ID;
    const clientSecret = constants.KEYCLOAK_CLIENT_SECRET;
    const grantType = 'refresh_token';

    // logger.debug(`curl -vL -H 'Content-Type: application/x-www-form-urlencoded' ${url} -d 'client_id=${clientId}&client_secret=${clientSecret}&grant_type=${grantType}&refresh_token=${refreshToken}'`);

    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: grantType,
      refresh_token: refreshToken,
    });
    try {
      const resp = await axios.post(url, data.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      res.send(resp.data);
    } catch (err) {
      let message = err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      res.sendStatus(401);
    }
  });

  const login = async (req, res, next, cb) => {
    const realm = constants.KEYCLOAK_REALM;
    const strategy = createStrategy({
      clientId: constants.KEYCLOAK_CLIENT_ID,
      clientSecret: constants.KEYCLOAK_CLIENT_SECRET,
      realm,
    });
    passport.authenticate(strategy, cb)(req, res, next);
  };

  const createStrategy = ({
    clientId,
    clientSecret,
    realm,
  }) => {
    const callbackURL = constants.KEYCLOAK_CALLBACK;
    const host = constants.KEYCLOAK_HOST;
    return new Strategy(
      {
        host,
        realm,
        clientID: clientId,
        clientSecret,
        callbackURL,
        authorizationURL: `${host}/realms/${realm}/protocol/openid-connect/auth`,
        tokenURL: `${host}/realms/${realm}/protocol/openid-connect/token`,
        userInfoURL: `${host}/realms/${realm}/protocol/openid-connect/userinfo`,
      },
      async (accessToken, refreshToken, profile, done) => {
        logger.log('debug', 'profile: %s', profile);
        await usersService.upsertUser(profile);
        return done(null, {
          ...profile,
          accessToken,
          refreshToken,
        });
      },
    );
  };

  /**
   * new KeycloakBearerStrategy(options, verify)
   *
   *   jwtPayload:  {
   *     exp: 1681802373,
   *     iat: 1681801773,
   *     auth_time: 1681801772,
   *     jti: 'XXXXXd7b-c27b-4b15-8224-001d61eXXXXX',
   *     iss: 'https://auth.acme.com/auth/realms/AgencyAI',
   *     aud: [ 'backend', 'account' ],
   *     sub: 'XXXXX795-ec4d-4073-b8a5-d456628XXXXX',
   *     typ: 'Bearer',
   *     azp: 'frontend',
   *     session_state: 'XXXXX5a0-c81c-4683-8760-50ef011XXXXX',
   *     acr: '1',
   *     realm_access: {
   *       roles: [
   *         'default-roles-agencyai',
   *         'offline_access',
   *         'app-admin',
   *         'uma_authorization',
   *         'app-user'
   *       ]
   *     },
   *     resource_access: {
   *       backend: { roles: [Array] },
   *       frontend: { roles: [Array] },
   *       account: { roles: [Array] }
   *     },
   *     scope: 'profile email client_roles_frontend',
   *     sid: 'XXXXX5a0-c81c-4683-8760-50ef011XXXXX',
   *     email_verified: true,
   *     roles: [ 'admin', 'user' ],
   *     name: 'Mark Mo',
   *     preferred_username: 'markmo',
   *     given_name: 'Mark',
   *     family_name: 'Mo',
   *     email: 'markmo@acme.com'
   *   }
   */
  return new KeycloakBearerStrategy({
    realm: constants.KEYCLOAK_REALM,
    url: constants.KEYCLOAK_HOST,
  }, async (jwtPayload, done) => {
    const { roles, sub: keycloakId } = jwtPayload;
    const savedUser = await usersService.getUserByKeycloakId(keycloakId);
    const user = { ...savedUser, roles };
    // logger.debug('user:', user);
    return done(null, user);
  });
}

export default Authenticator;
