/**
 * Cognito authentication utility functions for use with react-oidc-context.
 */

/**
 * Remove every persisted OIDC artifact (user + any in-flight signin state)
 * from both web storages. oidc-client-ts prefixes all of its keys with
 * "oidc.". Clearing these synchronously guarantees that when the browser
 * returns from the Cognito logout redirect there is no stale session left to
 * re-authenticate from — relying on auth.removeUser() alone has proven
 * unreliable across the Cognito round-trip and caused a
 * login -> app -> login flicker after logout.
 */
export const clearOidcStorage = () => {
  try {
    for (const store of [window.sessionStorage, window.localStorage]) {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith('oidc.')) {
          keys.push(k);
        }
      }
      keys.forEach((k) => store.removeItem(k));
    }
  } catch (e) {
    // Accessing storage can throw in some privacy modes — ignore.
  }
};

export const performLogout = async (auth) => {
  try {
    const cognitoDomain = process.env.REACT_APP_COGNITO_DOMAIN;
    const clientId = process.env.REACT_APP_COGNITO_CLIENT_ID;
    const logoutRedirectUri = process.env.REACT_APP_COGNITO_LOGOUT_REDIRECT_URI || window.location.origin;
    const logoutUri = encodeURIComponent(logoutRedirectUri);

    // Clear the persisted OIDC session synchronously. We intentionally do NOT
    // call auth.removeUser(): it mutates react-oidc-context state, which
    // triggers a re-render (briefly flashing /login) before the browser
    // leaves for Cognito. A full-page redirect tears down all in-memory state
    // anyway, so clearing storage is both sufficient and flicker-free.
    clearOidcStorage();

    if (cognitoDomain && clientId) {
      window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`;
    } else {
      window.location.href = '/login';
    }

    // The page is now navigating away. Return a promise that never resolves so
    // the caller (handleLogout) does not run navigate('/login') and re-render
    // the SPA mid-redirect — another source of the logout flicker.
    return new Promise(() => {});
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
