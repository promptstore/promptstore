/**
 * Cognito authentication utility functions for use with react-oidc-context.
 */

export const performLogout = async (auth) => {
  try {
    const cognitoDomain = process.env.REACT_APP_COGNITO_DOMAIN;
    const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
    const logoutRedirectUri = process.env.REACT_APP_COGNITO_LOGOUT_REDIRECT_URI || window.location.origin;
    const logoutUri = encodeURIComponent(logoutRedirectUri);

    if (auth.removeUser && typeof auth.removeUser === 'function') {
      await auth.removeUser();
    }

    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
  } catch (error) {
    console.error('Logout failed:', error);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  }
};

export const isAuthenticated = (auth) => {
  return auth && auth.isAuthenticated && !auth.isLoading;
};

export const getUserInfo = (auth) => {
  if (!isAuthenticated(auth)) {
    return { name: null, email: null };
  }

  const profile = auth.user?.profile || {};

  return {
    name: profile.name || profile.email || profile.preferred_username || 'Unknown User',
    email: profile.email,
    sub: profile.sub,
    groups: profile['cognito:groups'] || [],
    profile,
  };
};
