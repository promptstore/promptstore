module.exports = ({ app, logger, passport, services }) => {

  const { usersService } = services;

  app.get('/api/users/current', async (req, res, next) => {
    if (req.user) {
      res.json(req.user);
    } else {
      res.sendStatus(401);
    }
  });

  app.get('/api/users/id/:id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const id = req.params.id;
    const { getUserById } = usersService;
    const user = await getUserById(id);
    res.json(user);
  });

  app.get('/api/users/:user_id', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const userId = req.params.user_id;
    const { getUser } = usersService;
    const user = await getUser(userId);
    res.json(user);
  });

  app.get('/api/users', passport.authenticate('keycloak', { session: false }), async (req, res, next) => {
    const { getUsers } = usersService;
    const users = await getUsers();
    res.json(users);
  });

};