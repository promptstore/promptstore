import { isApiPathAllowed } from '../config/roles';

/**
 * Role-based API authorization.
 *
 * Composed into `auth` in app.js so that every route which uses the shared
 * `auth` middleware is gated, and routes registered without `auth` are left
 * alone. See config/roles.js for the path map.
 *
 * @param logger    winston logger
 * @param enforce   false puts the middleware in audit mode: denials are
 *                  logged as `[authz:audit] would deny ...` and allowed
 *                  through, so a release can be run to harvest gaps in the
 *                  map before switching enforcement on.
 */
export function createAuthz({ logger, enforce = true }) {
  return function authz(req, res, next) {
    // API-key principals are governed by the `scopes` model in VerifyToken,
    // not by console roles — hashed telemetry keys resolve to a req.user with
    // no `roles` at all. Breaking programmatic integrations is not an
    // acceptable side effect of a UI role model.
    // TODO: map API-key scopes onto roles and remove this bypass.
    if (req.apiKeyWorkspaceId != null || req.apiKeyType) {
      return next();
    }

    const { allowed, reason } = isApiPathAllowed(req.user, req.path, req.method);
    if (allowed) {
      return next();
    }

    const detail =
      `${req.method} ${req.path} user=${req.user?.username} ` +
      `roles=[${(req.user?.roles || []).join(',')}] reason=${reason}`;

    if (!enforce) {
      logger.warn('[authz:audit] would deny ' + detail);
      return next();
    }

    logger.warn('[authz] deny ' + detail);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Your role does not permit this operation',
      path: req.path,
    });
  };
}
