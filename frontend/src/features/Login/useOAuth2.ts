import { useCallback, useRef, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';

import {
  OAUTH_STATE_KEY,
  OAUTH_RESPONSE,
  POPUP_HEIGHT,
  POPUP_WIDTH,
} from './constants';
import {
  buildAuthorizeUrl,
  buildTokenUrl,
  generateState,
} from './utils';

export type AuthTokenPayload = {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token: string;
};

export type OAuth2Props = {
  navigate: Function;
  appId: string;
  authorizeUrl: string;
  redirectUrl: string;
  tokenUrl: string;
};

export type State<TData = AuthTokenPayload> = TData | null;

export type UIState = {
  error: string | null;
  loading: boolean;
};

const useOAuth2 = <TData = AuthTokenPayload>(props: OAuth2Props) => {
  const {
    navigate,
    appId,
    authorizeUrl,
    redirectUrl,
    tokenUrl,
  } = props;

  // console.log('useOAuth2 props:', props);

  const intervalRef = useRef<any>();
  const popupRef = useRef<Window | null>();

  const [{ error, loading }, setUI] = useState<UIState>({ error: null, loading: false });
  const [data, setData] = useLocalStorageState<State>(appId, {});

  const getAuth = useCallback(() => {
    // 1. Init
    setUI({ error: null, loading: true });

    // 2. Generate and save state
    const state = generateState();
    saveState(state);

    // 3. Open popup
    const url = buildAuthorizeUrl(authorizeUrl, appId, redirectUrl, state);
    console.info('AuthorizeUrl:', url);
    popupRef.current = openPopup(url);

    // 4. Register message listener
    const handleMessageListener = async (message: MessageEvent<any>) => {
      console.log('handleMessageListener:', message);
      try {
        const type = message?.data?.type;
        if (type === OAUTH_RESPONSE) {
          const errorMaybe = message?.data?.error;
          if (errorMaybe) {
            setUI({
              error: errorMaybe || 'Unknown Error',
              loading: false,
            });
          } else {
            const code = message?.data?.payload?.code;
            // console.log('code:', code);
            const url = buildTokenUrl(
              tokenUrl,
              appId,
              code,
              redirectUrl,
            );
            // console.log('url:', url);
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) {
              setUI({
                error: 'Failed to exchange code for token',
                loading: false,
              });
            } else {
              const data = await response.json();
              setUI({
                error: null,
                loading: false,
              });
              setData(data);
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        setUI({
          error: String(err),
          loading: false,
        });
      } finally {
        cleanup(intervalRef, popupRef, handleMessageListener);
        navigate(0);
      }
    }
    window.addEventListener('message', handleMessageListener);

    // 5. Begin interval to check if popup was closed forcefully by the user
    intervalRef.current = setInterval(() => {
      const popupClosed = !popupRef.current?.window || popupRef.current?.window?.closed;
      if (popupClosed) {
        // Popup was closed before completing auth...
        setUI((ui) => ({
          ...ui,
          loading: false,
        }));
        console.warn('Warning: popup was closed before completing authentication.');
        clearInterval(intervalRef.current);
        removeState();
        window.removeEventListener('message', handleMessageListener);
      }
    }, 250);

    // 6. Remove listener(s) on unmount
    return () => {
      window.removeEventListener('message', handleMessageListener);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [
    appId,
    authorizeUrl,
    redirectUrl,
    tokenUrl,
    setUI,
    setData,
  ]);

  return { getAuth, data, error, loading };
};

const saveState = (state: string) => {
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
};

const removeState = () => {
  sessionStorage.removeItem(OAUTH_STATE_KEY);
};

const openPopup = (url: string) => {
  // To fix issues with window.screen in multi-monitor setups, the easier option is to
  // center the pop-up over the parent window.
  const top = window.outerHeight / 2 + window.screenY - POPUP_HEIGHT / 2;
  const left = window.outerWidth / 2 + window.screenX - POPUP_WIDTH / 2;
  return window.open(
    url,
    'OAuth2 Popup',
    `height=${POPUP_HEIGHT},width=${POPUP_WIDTH},top=${top},left=${left}`
  );
};

const closePopup = (popupRef: React.MutableRefObject<Window | null | undefined>) => {
  popupRef.current?.close();
};

const cleanup = (
  intervalRef: React.MutableRefObject<any>,
  popupRef: React.MutableRefObject<Window | null | undefined>,
  handleMessageListener: any,
) => {
  clearInterval(intervalRef.current);
  closePopup(popupRef);
  removeState();
  window.removeEventListener('message', handleMessageListener);
};

export default useOAuth2;
