import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal } from 'antd';

import { Chat } from '../../../components/Chat';
import {
  getResponseAsync,
  selectMessages,
  setMessages,
} from './chatSlice';

export function ChatModal({ appId, app, loading, onCancel, onOk, open }) {

  const [selectedKeys, setSelectedKeys] = useState([]);

  const messages = useSelector(selectMessages);

  const dispatch = useDispatch();

  const handleOk = async () => {
    const firstMessage = messages[0];
    const selectedMessage = messages.find((m) => m.key === selectedKeys[0]);
    dispatch(setMessages({ messages: [] }));
    if (selectedMessage) {
      onOk({
        key: firstMessage.key,
        content: selectedMessage.content,
      });
    }
  };

  const handleSubmit = (values) => {
    dispatch(getResponseAsync({ ...app, ...values }));
  };

  const hasSelected = selectedKeys.length > 0;

  return (
    <Modal
      title="Chat to refine"
      okButtonProps={{
        disabled: !hasSelected,
      }}
      okText="Use"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      width={600}
    >
      <Chat
        appId={appId}
        app={app}
        loading={loading}
        messages={messages}
        onSelected={setSelectedKeys}
        onSubmit={handleSubmit}
      />
    </Modal >
  );
}