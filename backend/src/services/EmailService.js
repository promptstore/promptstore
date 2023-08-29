import { MailtrapClient } from 'mailtrap';

export function EmailService({ constants, logger }) {

  // logger.debug('Instantiating Mailtrap client with token:', constants.MAILTRAP_TOKEN);
  const client = new MailtrapClient({ token: constants.MAILTRAP_TOKEN });

  const sender = {
    name: 'Prompt Store',
    email: constants.SENDER_EMAIL,
  };

  /**
   * 
   * @param {*} email 
   * @param {*} params 
   * @returns 
   */
  function send(email, templateId, params) {
    logger.debug('sending email with parameters:', params);
    return client.send({
      from: sender,
      to: [{ email }],
      template_uuid: templateId,
      template_variables: params,
    });
  }

  return {
    send,
  };

}
