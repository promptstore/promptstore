function Calculator({ constants, logger }) {

  async function call(text) {
    try {
      return Parser.evaluate(text).toString();
    } catch (error) {
      return "I don't know how to do that.";
    }
  }

  return {
    call,
  };
}

module.exports = Calculator;