import passport from 'passport';
import util from 'util';
import BadRequestError from './errors/BadRequestError';

/**
 * `Strategy` constructor.
 *
 * The local api key authentication strategy authenticates requests based on the
 * credentials submitted through an HTML-based login form.
 *
 * Applications must supply a `verify` callback which accepts `username` and
 * `password` credentials, and then calls the `done` callback supplying a
 * `user`, which should be set to `false` if the credentials are not valid.
 * If an exception occured, `err` should be set.
 *
 * Optionally, `options` can be used to change the fields in which the
 * credentials are found.
 *
 * Options:
 *   - `apiKeyField`  field name where the apikey is found, defaults to _apiKey_
 *   - `apiKeyHeader`  header name where the apikey is found, defaults to _apiKey_
 *   - `passReqToCallback`  when `true`, `req` is the first argument to the verify callback (default: `false`)
 *
 * Examples:
 *
 *     passport.use(new LocalAPIKeyStrategy(
 *       function(apikey, done) {
 *         User.findOne({ apikey: apikey }, function (err, user) {
 *           done(err, user);
 *         });
 *       }
 *     ));
 *
 * @param {Object} options
 * @param {Function} verify
 * @api public
 */
function Strategy(options, verify) {
  if (typeof options == 'function') {
    verify = options;
    options = {};
  }
  if (!verify) throw new Error('local authentication strategy requires a verify function');

  this._apiKeyField = options.apiKeyField || 'apikey';
  this._apiKeyHeader = options.apiKeyHeader || 'apikey';

  passport.Strategy.call(this);
  this.name = 'localapikey';
  this._verify = verify;
  this._passReqToCallback = options.passReqToCallback;
}

/**
 * Inherit from `passport.Strategy`.
 */
util.inherits(Strategy, passport.Strategy);

/**
 * Authenticate request based on the contents of a form submission.
 *
 * @param {Object} req
 * @api protected
 */
Strategy.prototype.authenticate = function (req, options) {
  options = options || {};
  const apikey = lookup(req.body, this._apiKeyField)
    || lookup(req.query, this._apiKeyField)
    || lookup(req.headers, this._apiKeyHeader);

  if (!apikey) {
    return this.fail(new BadRequestError(options.badRequestMessage || 'Missing API Key'));
  }

  var self = this;

  function verified(err, user, info) {
    if (err) return self.error(err);
    if (!user) return self.fail(info);
    self.success(user, info);
  }

  if (self._passReqToCallback) {
    this._verify(req, apikey, verified);
  } else {
    this._verify(apikey, verified);
  }

  function lookup(obj, field) {
    if (!obj) { return null; }
    const chain = field.split(']').join('').split('[');
    for (let i = 0, len = chain.length; i < len; i++) {
      var prop = obj[chain[i]];
      if (typeof (prop) === 'undefined') return null;
      if (typeof (prop) !== 'object') return prop;
      obj = prop;
    }
    return null;
  }
}

export default Strategy;
