import axios from 'axios';
import createAuthRefreshInterceptor from 'axios-auth-refresh';

function ApiService() {

  const instance = axios.create({
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  });

  let state;
  let onRefreshCallback;
  let onExpiryCallback;

  const setToken = (token) => {
    state = token;
    if (typeof onRefreshCallback === 'function') {
      onRefreshCallback(token);
    }
  };

  const onRefresh = (callback) => {
    onRefreshCallback = callback;
  };

  const onExpiry = (callback) => {
    onExpiryCallback = callback;
  };

  const getAccessToken = () => {
    return state?.accessToken;
  };

  const getRefreshToken = () => {
    return state?.refreshToken;
  };

  const renewToken = () => {
    const refreshToken = getRefreshToken();
    return getNewToken(refreshToken).then(setToken);
  };

  const getNewToken = (refreshToken) => {
    return new Promise(async (resolve, reject) => {
      const url = '/api/auth/refresh';
      try {
        const resp = await axios.post(url, { refreshToken }, {
          headers: {
            'Content-Type': 'application/json',
          }
        });
        if (resp.status === 200) {

          // console.log('refresh: ', resp);

          const { access_token, refresh_token } = resp.data;
          resolve({
            accessToken: access_token,
            refreshToken: refresh_token,
          });

        } else {
          reject(resp.data);
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  // https://thedutchlab.com/blog/using-axios-interceptors-for-refreshing-your-api-token
  // https://stackoverflow.com/questions/57251719/acquiring-a-new-token-with-axios-interceptors
  instance.interceptors.request.use((config) => {
    // console.log('config:', config);

    const accessToken = getAccessToken();
    // console.log('accessToken:', accessToken);

    config.headers['Authorization'] = 'Bearer ' + accessToken;

    return config;

  }, (err) => {
    return Promise.reject(err);
  });

  // https://www.npmjs.com/package/axios-auth-refresh
  const refreshAuthLogic = (failedRequest) => {
    // console.log('failedRequest:', failedRequest);

    const refreshToken = getRefreshToken();
    // console.log('refreshToken:', refreshToken);

    return getNewToken(refreshToken)
      .then((token) => {
        // console.log('update:', token);

        setToken(token);

        failedRequest.response.config.headers['Authorization'] = 'Bearer ' + token.accessToken;

        return Promise.resolve();
      })
      .catch((err) => {
        if (typeof onExpiryCallback === 'function') {
          onExpiryCallback(err);
        }
      });
  }

  createAuthRefreshInterceptor(instance, refreshAuthLogic);

  return {
    http: instance,
    onTokenExpiry: onExpiry,
    onTokenRefresh: onRefresh,
    renewToken,
    setToken,
  };
}

export const { http, onTokenExpiry, onTokenRefresh, renewToken, setToken } = ApiService();