export default ({ app, auth, logger, services }) => {

  const { usersService } = services;

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
    const user = await usersService.upsertUser(req.body);
    res.json(user);
  });

  app.post('/api/roles', auth, async (req, res) => {
    const { username } = req.user;
    const { role } = req.body;
    await usersService.setRole(username, role);
    res.json({ status: 'OK' });
  });

  app.delete('/api/users', auth, async (req, res, next) => {
    const ids = req.query.ids.split(',');
    await usersService.deleteUsers(ids);
    res.json(ids);
  });

};
