const { v4: uuidv4 } = require('uuid');

const Strategy = require('./Strategy');

function Authenticator({ __name, constants, logger, app, passport, rc }) {

  app.post('/api/auth/one-time-token', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { email } = req.body;
    const token = uuidv4();
    rc.hset(constants.TOKEN_STORE_KEY, token, email);
    res.send({ token });
  });

  return new Strategy(async (apikey, done) => {
    // service account key for AGENCEE
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

module.exports = Authenticator;