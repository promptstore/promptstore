// AWS Cognito authentication configuration for react-oidc-context
const authConfig = {
  authority: process.env.REACT_APP_COGNITO_AUTHORITY,
  client_id: process.env.REACT_APP_COGNITO_CLIENT_ID,
  redirect_uri: process.env.REACT_APP_COGNITO_REDIRECT_URI || `${window.location.origin}/callback`,
  post_logout_redirect_uri: process.env.REACT_APP_COGNITO_LOGOUT_REDIRECT_URI || window.location.origin,
  response_type: 'code',
  scope: process.env.REACT_APP_COGNITO_SCOPE || 'openid profile email',

  automaticSilentRenew: true,
  loadUserInfo: true,

  monitorSession: false,

  // Cognito-specific settings (used by logout helper)
  cognitoDomain: process.env.REACT_APP_COGNITO_DOMAIN,
  region: process.env.REACT_APP_AWS_REGION || 'ap-southeast-2',
  userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
};

export default authConfig;
