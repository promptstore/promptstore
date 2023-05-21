import React, { useEffect } from 'react';

import { OAUTH_RESPONSE, OAUTH_STATE_KEY } from './constants';
import { queryToObject } from './utils';

type Props = {
  Component?: React.ReactElement;
};

// React.Strict mode is on in index.ts
// StrictMode renders components twice (in dev but not production)
// in order to detect any problems with your code and warn you about them,
// but in this case is causing the OAUTH_RESPONSE message to be posted twice.
let count = 0;

const OAuthPopup = (props: Props) => {
  const {
    Component = (
      <div style={{ margin: '12px' }} data-testid="popup-loading">
        Logging in...
      </div>
    ),
  } = props;

  useEffect(() => {
    if (count === 0) {
      const payload = queryToObject(window.location.search.split('?')[1]);
      const error = payload?.error;
      const state = payload?.state;

      if (!window.opener) {
        throw new Error('No window opener');
      }

      if (error) {
        window.opener.postMessage({
          type: OAUTH_RESPONSE,
          error: decodeURI(error) || 'OAuth error.',
        });
      } else if (state && checkState(state)) {
        window.opener.postMessage({
          type: OAUTH_RESPONSE,
          payload,
        });
      } else {
        window.opener.postMessage({
          type: OAUTH_RESPONSE,
          error: 'OAuth error: state mismatch.',
        });
      }
    }
    count += 1;
  }, []);

  return Component;
};

const checkState = (receivedState: string) => {
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  return state === receivedState;
};

export default OAuthPopup;
