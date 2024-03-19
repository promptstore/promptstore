import { Version3Client } from 'jira.js';

function JiraService({ __key, __name, constants, logger }) {

  let client;

  function getClient() {
    if (!client) {
      client = new Version3Client({
        host: constants.JIRA_API_URL,
        authentication: {
          basic: {
            email: constants.JIRA_EMAIL,
            apiToken: constants.JIRA_PAT,
          },
          // personalAccessToken: constants.JIRA_PAT,
        },
      });
    }
    return client;
  }

  async function call({ summary, description }) {
    try {
      const client = getClient();
      const res = await client.issues.createIssue({
        fields: {
          summary,
          issuetype: {
            name: 'Task',
          },
          project: {
            key: constants.JIRA_PROJECT_KEY,
          },
          description,
        }
      });
      logger.debug('res:', res);
      if (res.id) {
        return 'Created issue ID: ' + id;
      } else {
        return "I don't know how to do that";
      }
    } catch (err) {
      logger.error(err, err.stack);
      return "I don't know how to do that";
    }
  }

  function getOpenAPIMetadata() {
    return {
      name: __key,
      description: constants.JIRA_DESCRIPTION,
      parameters: {
        properties: {
          summary: {
            description: 'Task summary',
            type: 'string',
          },
          description: {
            description: 'Task description',
            type: 'string',
          }
        },
        required: ['summary'],
        type: 'object',
      },
    };
  }

  return {
    __name,
    __description: constants.JIRA_DESCRIPTION,
    call,
    getOpenAPIMetadata,
  };
}

export default JiraService;
