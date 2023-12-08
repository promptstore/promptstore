import { MailtrapClient } from 'mailtrap';

function EmailService({ __key, __name, constants, logger }) {

  // logger.debug('Instantiating Mailtrap client with token: ', constants.MAILTRAP_TOKEN);
  const client = new MailtrapClient({ token: constants.MAILTRAP_TOKEN });

  const sender = {
    name: 'Prompt Store',
    email: constants.SENDER_EMAIL,
  };

  /**
   * {
   *   "firstName": "Test_FirstName",
   *   "format": "Test_Format",
   *   "content": "Test_Content",
   *   "contentId": "Test_ContentId",
   *   "username": "Test_Username"
   * }
   * 
   * @param {*} email 
   * @param {*} params 
   * @returns 
   */
  async function call({ agentName, email, message }) {
    logger.debug('Sending email using the following parameters:', { agentName, email, message });
    const res = await client.send({
      from: sender,
      to: [{ email }],
      template_uuid: constants.MAILTRAP_TEMPLATE_UUID,
      template_variables: {
        agent_name: agentName,
        message,
      },
    });
    // logger.log('debug', 'res:', res);
    if (res.success) {
      return 'Email was successfully sent.';
    } else {
      return 'Email could not be sent.';
    }
  }

  function getOpenAIMetadata() {
    return {
      name: __key,
      description: constants.EMAIL_DESCRIPTION,
      parameters: {
        properties: {
          message: {
            description: 'email message',
            type: 'string',
          },
        },
        required: ['message'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.EMAIL_DESCRIPTION,
    call,
    getOpenAIMetadata,
  };
}

export default EmailService;
