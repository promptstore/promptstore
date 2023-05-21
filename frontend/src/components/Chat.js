import { forwardRef, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Avatar, Button, Input, Radio, Space, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

import { setContents } from '../features/apps/Playground/contentSlice';

const { TextArea } = Input;

export function Chat({
  appId,
  app,
  disabled,
  enableActions,
  loading,
  messages,
  onSelected,
  onSubmit,
  onReset,
  suggestPrompts,
  tourRefs,
}) {

  const [selected, setSelected] = useState({});

  const selectedKeys = Object.entries(selected).filter(([_, v]) => v).map(([k, _]) => k);
  const hasSelected = selectedKeys.length > 0;

  const hasMessages = messages.length > 0;

  const inputRef = useRef();

  const dispatch = useDispatch();

  const handleChange = (key) => {
    setSelected({ [key]: true });
    if (typeof onSelected === 'function') {
      onSelected([key]);
    }
  };

  const handleReset = () => {
    setSelected({});
    if (typeof onReset === 'function') {
      onReset();
    }
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    const msg = {
      key: uuidv4(),
      role: 'user',
      content: inputRef.current.resizableTextArea.textArea.value,
    };
    inputRef.current.resizableTextArea.textArea.value = '';
    onSubmit({ app, messages: [...messages, msg] });
  };

  const handleSuggestPrompts = () => {
    suggestPrompts({ messages });
  };

  const useContent = () => {
    if (hasSelected) {
      const contents = [];
      for (const key of selectedKeys) {
        const message = messages.find((m) => m.key === key);
        if (message) {
          contents.push({
            appId,
            contentId: uuidv4(),
            isNew: true,
            text: message.content,
            model: message.model,
            usage: message.usage,
          });
        }
      }
      if (contents.length) {
        dispatch(setContents({ contents }));
      }
      setSelected({});
    }
  };

  const AssistantMessage = ({ first, message }) => {
    if (first) {
      return (
        <div className="chatline assistant">
          <div className="ant-radio"></div>
          <div className="avatar"><Avatar>A</Avatar></div>
          <div className="content">{message.content}</div>
        </div>
      );
    }
    return (
      <Radio value={message.key}>
        <div className="chatline assistant">
          <div className="avatar"><Avatar>A</Avatar></div>
          <div className="content">{message.content}</div>
        </div>
      </Radio>
    );
  };

  const UserMessage = ({ message }) => (
    <div className="chatline user">
      <div className="content">
        <div>{message.content}</div>
      </div>
      <div className="avatar"><Avatar>U</Avatar></div>
    </div>
  );

  const Message = ({ first, message }) => {
    if (message.role === 'assistant') {
      return (
        <AssistantMessage first={first} message={message} />
      );
    }
    return (
      <UserMessage message={message} />
    );
  };

  const Messages = ({ messages, onChange, value }) => (
    <Radio.Group onChange={onChange} value={value}>
      {messages.map((m, i) => (
        <Message key={m.key} first={i === 0} message={m} />
      ))}
    </Radio.Group>
  );

  const Loading = ({ loading }) => {
    if (!loading) {
      return null;
    }
    return (
      <div style={{ margin: '20px 0', textAlign: 'center' }}>
        <Spin />
      </div>
    );
  };

  const MessagesSection = ({ disabled, loading, messages, onChange, value }) => {
    if (disabled) {
      return (
        <div></div>
      );
    }
    return (
      <>
        <Messages
          messages={messages}
          onChange={onChange}
          value={value}
        />
        <Loading loading={loading} />
      </>
    );
  };

  const Actions = ({
    disabled,
    handleSuggestPrompts,
    hasMessages,
    hasSelected,
    startNewChatSession,
    useContent,
    visible,
  }) => {
    if (!visible) {
      return null;
    }
    return (
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" size="small"
          disabled={disabled}
          onClick={handleSuggestPrompts}
        >
          Suggest Prompts
        </Button>
        <Button type="primary" size="small"
          disabled={disabled || !hasSelected}
          onClick={useContent}
        >
          Use Selected Content
        </Button>
        <Button type="primary" size="small"
          disabled={disabled || !hasMessages}
          onClick={startNewChatSession}
        >
          New Session
        </Button>
      </Space>
    );
  };

  const MessageInput = forwardRef(({ disabled, handleSubmit, loading }, ref) => {

    const [value, setValue] = useState(false);

    const handleChange = (ev) => {
      setValue(ev.target.value);
    };

    return (
      <div style={{ display: 'flex' }}>
        <TextArea
          ref={ref}
          autoSize={{ minRows: 1, maxRows: 14 }}
          onPressEnter={handleSubmit}
          style={{ flex: 1 }}
          onChange={handleChange}
          placeholder={'For example: "limit to three words"'}
        />
        <Button type="text"
          disabled={disabled || loading || !value}
          icon={<SendOutlined />}
          onClick={handleSubmit}
        />
      </div>
    );
  });

  return (
    <div className="chat">
      <MessagesSection
        disabled={disabled}
        loading={loading}
        messages={messages}
        onChange={(ev) => handleChange(ev.target.value)}
        value={selectedKeys[0]}
      />
      <Actions
        disabled={disabled}
        handleSuggestPrompts={handleSuggestPrompts}
        hasMessages={hasMessages}
        hasSelected={hasSelected}
        startNewChatSession={handleReset}
        useContent={useContent}
        visible={enableActions}
      />
      <div ref={tourRefs.prompt}>
        <MessageInput
          ref={inputRef}
          disabled={disabled}
          handleSubmit={handleSubmit}
          loading={loading}
        />
      </div>
    </div>
  );
}