import { useEffect } from 'react';

export const useBeforeUnload = (when, message) => {
  useEffect(() => {
    const handleBeforeUnload = (ev) => {
      if (when) {
        ev.preventDefault();
        ev.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [when, message]);

};