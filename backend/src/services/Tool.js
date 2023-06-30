function Tool({ logger, registry }) {

  function getTool(skill) {
    return registry[skill];
  }

  return {
    getTool,
  }
}

module.exports = {
  Tool,
}