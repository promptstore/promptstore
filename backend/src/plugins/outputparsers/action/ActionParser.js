const FINAL_ANSWER_ACTION = 'Final Answer:';

function ActionParser({ __name, __metadata, constants, logger, app, auth }) {

  async function parse(text) {
    logger.debug('parsing:', text);
    if (!text) {
      return {
        error: { message: 'Nothing to parse' },
        nonJsonStr: text,
      };
    }
    try {
      const hasFinalAnswer = text.includes(FINAL_ANSWER_ACTION);
      // const actionRegex = new RegExp(
      //   /Action\s*\d*\s*:[\s]*(.*?)[\s]*Action\s*\d*\s*Input\s*\d*\s*:[\s]*(.*)/,
      //   'gs'
      // );
      const actionRegex = new RegExp(
        /.*?Action\s*\d*\s*:[\s\n]*((?:(?!Action\s*\d*\s*Input\s*\d*\s*:).)*)/,
        's'
      );
      const inputRegex = new RegExp(
        /.*?Action\s*\d*\s*Input\s*\d*\s*:[\s\n]*(.*)/,
        's'
      );
      const actionMatch = text.match(actionRegex);
      if (actionMatch) {
        const action = actionMatch[1];
        if (hasFinalAnswer) {
          const message =
            `Parsing LLM output produced both a final answer and a parseable ` +
            `action: ${action}`;
          return { error: { message }, retriable: true };
        }
        const inputMatch = text.match(inputRegex);
        if (inputMatch) {
          const actionInput = inputMatch[1];
          let input = actionInput.trim();

          // if it's a SQL query don't remove trailing quotes
          if (!input.startsWith('SELECT ')) {
            input = trim(input, '"');
          }
          return { json: { action, args: { input } } };
        }
        return { json: { action } };
      }
      if (hasFinalAnswer) {
        const content = text.split(FINAL_ANSWER_ACTION)[1].trim();
        return { json: { content, final: true } };
      }
      return { json: { content: text } };

    } catch (err) {
      let message = `Error parsing text "${text}": ` + err.message;
      if (err.stack) {
        message += '\n' + err.stack;
      }
      logger.error(message);
      return {
        error: { message },
        nonJsonStr: text,
      };
    }
  }

  return {
    __name,
    __metadata,
    parse,
  };

}

export default ActionParser;
