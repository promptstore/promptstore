import { ROLES } from '../config/roles';

export default ({ app, auth, logger, services }) => {
  const { usersService } = services;

  const isAdminUser = (req) => (req.user?.roles || []).includes('admin');

  const requireAdmin = (req, res) => {
    if (isAdminUser(req)) return true;
    res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
    return false;
  };

  const invalidRoles = (roles) => roles.filter((r) => !ROLES.includes(r));

  app.get('/api/users/current', auth, async (req, res, next) => {
    if (req.user) {
      const user = await usersService.getUser(req.user.username);
      res.json(user);
    } else {
      res.sendStatus(401);
    }
  });

  app.get('/api/users/id/:id', auth, async (req, res, next) => {
    const id = req.params.id;
    const { getUserById } = usersService;
    const user = await getUserById(id);
    res.json(user);
  });

  app.get('/api/users/:user_id', auth, async (req, res, next) => {
    const userId = req.params.user_id;
    const { getUser } = usersService;
    const user = await getUser(userId);
    res.json(user);
  });

  app.get('/api/users', auth, async (req, res, next) => {
    const { getUsers } = usersService;
    const users = await getUsers();
    res.json(users);
  });

  app.post('/api/users', auth, async (req, res) => {
    logger.debug('req.body:', req.body);
    const body = { ...req.body };
    if (!isAdminUser(req)) {
      // A non-admin may only edit their own record, and may never set roles
      // or credits. upsertUser is a partial merge, so simply dropping the
      // fields leaves the stored values intact.
      if (body.username && body.username !== req.user.username) {
        return res.status(403).json({ error: 'Forbidden', message: 'Cannot modify another user' });
      }
      body.username = req.user.username;
      delete body.roles;
      delete body.credits;
    } else if (body.roles) {
      const bad = invalidRoles(body.roles);
      if (bad.length) {
        return res.status(400).json({ error: `Unknown role(s): ${bad.join(', ')}` });
      }
    }
    const user = await usersService.upsertUser(body, true);
    res.json(user);
  });

  app.post('/api/roles', auth, async (req, res) => {
    // The target comes from the body, not req.user. The previous version read
    // the username from req.user, so any authenticated caller could promote
    // themselves to admin.
    const { username, role, roles } = req.body;
    const requested = Array.isArray(roles) ? roles : role ? [role] : null;
    if (!requested || !requested.length) {
      return res.status(400).json({ error: 'role or roles is required' });
    }
    const bad = invalidRoles(requested);
    if (bad.length) {
      return res.status(400).json({ error: `Unknown role(s): ${bad.join(', ')}` });
    }

    const target = username || req.user.username;

    try {
      if (!isAdminUser(req)) {
        // First-run bootstrap: the very first user may claim admin for
        // themselves while no admin exists. See WorkspaceForm.onFinish, which
        // dispatches setAdmin() when the user creates their first workspace.
        // Without this a Cognito/Firebase install has no way to get an admin,
        // since the fixture admins only exist on a fresh Postgres volume.
        const selfBootstrap =
          target === req.user.username &&
          requested.length === 1 &&
          requested[0] === 'admin' &&
          (await usersService.countAdmins()) === 0;

        if (!selfBootstrap) {
          return res.status(403).json({ error: 'Forbidden', message: 'Admin role required' });
        }
        logger.warn(`[bootstrap] granting admin to first user ${target}`);
      }

      await usersService.setRoles(target, requested);
      res.json({ status: 'OK', username: target, roles: requested });
    } catch (err) {
      // Express 4 does not catch async throws, and an unanswered request
      // hangs the client rather than failing.
      logger.error('POST /api/roles failed:', err.message);
      res.status(500).json({ error: 'Failed to set roles' });
    }
  });

  app.delete('/api/users', auth, async (req, res, next) => {
    if (!requireAdmin(req, res)) return;
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    await usersService.deleteUsers(ids);
    res.json(ids);
  });
};
