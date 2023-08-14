import { useEffect } from 'react';
import { Modal } from 'antd';

import { useAuth } from '../contexts/AuthContext';

export default function ErrorMessage() {

  const { error, setError } = useAuth();

  useEffect(() => {
    if (error) {
      Modal.error({
        title: error,
        onOk: () => { setError('') },
      })
    }
  }, [error]);

  return (
    <></>
  );
}
