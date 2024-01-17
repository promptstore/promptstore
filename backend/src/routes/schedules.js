export default ({ app, auth, constants, logger, services, workflowClient }) => {

  app.post('/api/schedules/:scheduleId/pause', auth, async (req, res) => {
    const { scheduleId } = req.params;
    await workflowClient.pauseSchedule(scheduleId, {
      address: constants.TEMPORAL_URL,
    });
    res.json({ status: 'OK' });
  });

  app.post('/api/schedules/:scheduleId/unpause', auth, async (req, res) => {
    const { scheduleId } = req.params;
    await workflowClient.unpauseSchedule(scheduleId, {
      address: constants.TEMPORAL_URL,
    });
    res.json({ status: 'OK' });
  });

  app.post('/api/schedules/:scheduleId/delete', auth, async (req, res) => {
    const { scheduleId } = req.params;
    await workflowClient.deleteSchedule(scheduleId, {
      address: constants.TEMPORAL_URL,
    });
    res.json({ status: 'OK' });
  });

};