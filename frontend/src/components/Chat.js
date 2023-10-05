import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Avatar, Button, Checkbox, Divider, Input, Radio, Space, Spin, Typography } from 'antd';
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
  onSave,
  onSelected,
  onSubmit,
  onReset,
  onUseSelected,
  placeholder,
  selectable,
  selectMultiple,
  suggestPrompts,
  tourRefs,
  traceId,
}) {

  if (!placeholder) {
    placeholder = 'For example: "limit to three words"';
  }

  const [indeterminate, setIndeterminate] = useState(false);
  const [selected, setSelected] = useState({});
  const [checkAll, setCheckAll] = useState(false);
  const [input, setInput] = useState(null);
  const [lastInput, setLastInput] = useState(null);

  const selectedKeys = Object.entries(selected).filter(([_, v]) => v).map(([k, _]) => k);
  const hasSelected = selectedKeys.length > 0;

  const hasMessages = messages.length > 0;

  const dispatch = useDispatch();

  const handleChange = (key) => {
    if (selectMultiple) {
      const selectedUpdate = {
        ...selected,
        [key]: !selected[key],
      };
      const selectedEntries = Object.entries(selectedUpdate).filter(([_, v]) => v).map(([k, _]) => k);
      if (selectedEntries.length > 0 && selectedEntries.length < messages.length) {
        setIndeterminate(true);
      } else {
        setIndeterminate(false);
      }
      if (selectedEntries.length === messages.length) {
        setCheckAll(true);
      } else {
        setCheckAll(false);
      }
      setSelected(selectedUpdate);
      if (typeof onSelected === 'function') {
        onSelected(selectedEntries);
      }
    } else {
      setSelected({ [key]: true });
      if (typeof onSelected === 'function') {
        onSelected([key]);
      }
    }
  };

  const handleReset = () => {
    setSelected({});
    if (typeof onReset === 'function') {
      onReset();
    }
  };

  const handleSave = () => {
    setSelected({});
    if (typeof onSave === 'function') {
      onSave(messages);
    }
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    const msg = {
      key: uuidv4(),
      role: 'user',
      content: input,
    };
    setLastInput(input);
    setInput(null);
    onSubmit({ app, messages: [...messages, msg] });
  };

  const regenerate = () => {
    const msg = {
      key: uuidv4(),
      role: 'user',
      content: lastInput,
    };
    onSubmit({ app, messages: [...messages, msg] });
  };

  const handleSuggestPrompts = () => {
    suggestPrompts({ messages });
  };

  const onCheckAllChange = (ev) => {
    if (ev.target.checked) {
      setCheckAll(true);
      const selectedUpdate = messages.reduce((a, m) => {
        a[m.key] = true;
        return a;
      }, {});
      setSelected(selectedUpdate);
      const selectedEntries = Object.entries(selectedUpdate).filter(([_, v]) => v).map(([k, _]) => k);
      if (typeof onSelected === 'function') {
        onSelected(selectedEntries);
      }
    } else {
      setCheckAll(false);
      setSelected({});
    }
    setIndeterminate(false);
  };

  const useContent = () => {
    if (hasSelected) {
      if (typeof onUseSelected === 'function') {
        const msgs = messages.filter((m) => selectedKeys.indexOf(m.key) !== -1);
        onUseSelected(msgs);
      } else {
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
    }
  };

  const AssistantMessage = ({ first, message, onChange }) => {
    if (!selectable || (first && !selectMultiple)) {
      return (
        <div className="chatline assistant">
          <div className="ant-radio"></div>
          <div className="avatar"><Avatar>A</Avatar></div>
          <div className="content">
            <Space size="large">
              {message.content.map((c, i) => (
                <div key={c.key} className={i > 0 ? 'chat-sep' : ''}>
                  <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>
                  <div className="text-secondary" style={{ marginTop: 8 }}>{c.model}</div>
                </div>
              ))}
            </Space>
          </div>
        </div>
      );
    }
    if (selectMultiple) {
      return (
        <Checkbox value={message.key} onChange={onChange} checked={selected[message.key]}>
          <div className="chatline assistant">
            <div className="avatar"><Avatar>A</Avatar></div>
            <div className="content">
              <Space size="large">
                {message.content.map((c, i) => (
                  <div key={c.key} className={i > 0 ? 'chat-sep' : ''}>
                    <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>
                    <div className="text-secondary" style={{ marginTop: 8 }}>{c.model}</div>
                  </div>
                ))}
              </Space>
            </div>
          </div>
        </Checkbox>
      );
    }
    return (
      <Radio value={message.key}>
        <div className="chatline assistant">
          <div className="avatar"><Avatar>A</Avatar></div>
          <div className="content">
            <Space size="large">
              {message.content.map((c, i) => (
                <div key={c.key} className={i > 0 ? 'chat-sep' : ''}>
                  <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>
                  <div className="text-secondary" style={{ marginTop: 8 }}>{c.model}</div>
                </div>
              ))}
            </Space>
          </div>
        </div>
      </Radio>
    );
  };

  const UserMessage = ({ message, onChange }) => {
    if (selectMultiple) {
      return (
        <Checkbox value={message.key} onChange={onChange} checked={selected[message.key]}>
          <div className="chatline user">
            <div className="content">
              <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography.Text>
            </div>
            <div className="avatar"><Avatar>U</Avatar></div>
          </div>
        </Checkbox>
      );
    }
    return (
      <div className="chatline user">
        <div className="content">
          <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography.Text>
        </div>
        <div className="avatar"><Avatar>U</Avatar></div>
      </div>
    );
  };

  const Message = ({ first, message, onChange }) => {
    if (message.role === 'assistant') {
      return (
        <AssistantMessage first={first} message={message} onChange={onChange} />
      );
    }
    return (
      <UserMessage message={message} onChange={onChange} />
    );
  };

  const Messages = ({ messages, onChange, value }) => {
    if (selectable) {
      if (selectMultiple) {
        return (
          <div style={{ marginBottom: 24 }}>
            {messages.map((m, i) => (
              <Message key={m.key} first={i === 0} message={m} onChange={onChange} />
            ))}
          </div>
        );
      }
      return (
        <Radio.Group onChange={onChange} value={value}>
          {messages.map((m, i) => (
            <Message key={m.key} first={i === 0} message={m} />
          ))}
        </Radio.Group>
      );
    }
    return (
      <div style={{ marginBottom: 24 }}>
        {messages.map((m, i) => (
          <Message key={m.key} first={i === 0} message={m} />
        ))}
      </div>
    )
  };

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
        {selectMultiple && messages.length > 0 ?
          <>
            <Checkbox indeterminate={indeterminate} onChange={onCheckAllChange} checked={checkAll}>
              {checkAll ? 'Unselect all' : 'Select all'}
            </Checkbox>
            <Divider />
          </>
          : null
        }
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
    hasMessages,
    hasSelected,
    regenerate,
    saveChatSession,
    startNewChatSession,
    useContent,
    visible,
  }) => {
    if (!visible) {
      return null;
    }
    return (
      <div className="chat-actions">
        {selectable ?
          <Button type="primary" size="small"
            disabled={disabled || !hasSelected}
            onClick={useContent}
          >
            Use Selected Content
          </Button>
          : null
        }
        <Button type="primary" size="small"
          disabled={disabled || !hasMessages}
          onClick={startNewChatSession}
        >
          New Session
        </Button>
        {onSave ?
          <Button type="primary" size="small"
            disabled={disabled || !hasMessages}
            onClick={saveChatSession}
          >
            Save Session
          </Button>
          : null
        }
        <Button type="primary" size="small"
          disabled={disabled || !hasMessages}
          onClick={regenerate}
        >
          Regenerate
        </Button>
        {traceId ?
          <div style={{ color: '#1677ff', flex: 1, marginRight: 36, textAlign: 'end' }}>
            <Link to={`/traces/${traceId}`}>Latest trace...</Link>
          </div>
          : null
        }
      </div>
    );
  };

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
        regenerate={regenerate}
        saveChatSession={handleSave}
        startNewChatSession={handleReset}
        useContent={useContent}
        visible={enableActions}
      />
      <div ref={tourRefs?.prompt}>
        <MessageInput
          disabled={disabled}
          handleSubmit={handleSubmit}
          loading={loading}
          onChange={setInput}
          placeholder={placeholder}
          value={input}
        />
      </div>
    </div>
  );
}

const MessageInput = ({ disabled, handleSubmit, loading, onChange, placeholder, value }) => {

  const handleChange = (ev) => {
    onChange(ev.target.value);
  };

  return (
    <div>
      <div style={{ display: 'flex' }}>
        <TextArea
          autoSize={{ minRows: 1, maxRows: 14 }}
          onPressEnter={(ev) => {
            if (!ev.shiftKey) {
              ev.preventDefault();
              if (!disabled && ev.target.value) {
                handleSubmit(ev);
              }
            }
          }}
          style={{ flex: 1 }}
          onChange={handleChange}
          placeholder={placeholder}
          value={value}
        />
        <Button type="text"
          disabled={disabled || loading || !value}
          icon={<SendOutlined />}
          onClick={handleSubmit}
        />
      </div>
      <p style={{ lineHeight: '32px' }}>Press Shift+Enter to insert a new line.</p>
    </div>
  );
};
