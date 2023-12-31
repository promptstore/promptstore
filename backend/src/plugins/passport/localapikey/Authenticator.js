import uuid from 'uuid';

import Strategy from './Strategy';

function Authenticator({ __name, constants, logger, app, passport, rc }) {

  app.post('/api/auth/one-time-token', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { email } = req.body;
    const token = uuid.v4();
    rc.hset(constants.TOKEN_STORE_KEY, token, email);
    res.send({ token });
  });

  return new Strategy(async (apikey, done) => {
    if (apikey === constants.PROMPTSTORE_API_KEY) {
      return done(null, { email: constants.PROMPTSTORE_EMAIL });
    }
    try {
      const email = await rc.hget(constants.TOKEN_STORE_KEY, apikey);
      if (!email) return done(null, false);
      await rc.hdel(constants.TOKEN_STORE_KEY, apikey);
      return done(null, { email });
    } catch (err) {
      return done(err);
    }
  })
}

export default Authenticator;
