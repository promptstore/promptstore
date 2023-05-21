import { useEffect } from 'react';
import { unstable_useBlocker as useBlocker } from 'react-router-dom';

export const usePrompt = (when, message, confirmation) => {

  const blocker = useBlocker(when);

  useEffect(() => {
    if (blocker.state === 'blocked' && !when) {
      blocker.reset();
    }
  }, [blocker, when]);

  useEffect(() => {
    (async () => {
      if (blocker.state === 'blocked') {
        const proceed = await confirmation(message);
        if (proceed) {
          setTimeout(blocker.proceed, 0);
        } else {
          blocker.reset();
        }
      }
    })();
  }, [blocker, message]);
};