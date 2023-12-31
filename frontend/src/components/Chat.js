import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { Avatar, Button, Checkbox, Divider, Image, Input, Radio, Space, Spin, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

import { setContents } from '../features/apps/Playground/contentSlice';

const { TextArea } = Input;

export function Chat({
  appId,
  app,
  disabled,
  enableActions,
  enableCritique,
  loading,
  messages,
  onCritique,
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
    placeholder = 'Ask away...';
  }

  // console.log('messages:', messages);

  const [indeterminate, setIndeterminate] = useState(false);
  const [selected, setSelected] = useState({});
  const [checkAll, setCheckAll] = useState(false);
  const [input, setInput] = useState(null);
  // const [lastInput, setLastInput] = useState(null);

  let previewVisible = false;

  const selectedEntries = Object.entries(selected).filter(([_, v]) => v.checked).map(([k, v]) => [k, v.index]);
  selectedEntries.sort((a, b) => a[1] < b[1] ? -1 : 1);
  const selectedKeys = selectedEntries.map(x => x[0]);
  const hasSelected = selectedKeys.length > 0;

  const hasMessages = messages.length > 0;

  const dispatch = useDispatch();

  const findMessage = (key) => {
    for (const m of messages) {
      if (m.role === 'assistant' && Array.isArray(m.content)) {
        const content = m.content.find(c => c.key === key);
        if (content) {
          return { message: m, content };
        }
      } else if (m.key === key) {
        return { message: m };
      }
    }
    return {};
  };

  const handleChange = (key) => {
    if (previewVisible) return;
    if (selectMultiple) {
      const { message, content } = findMessage(key);
      let selectedUpdate;
      if (content) {
        selectedUpdate = {
          ...selected,
          ...message.content.reduce((a, c) => {
            a[c.key] = {
              checked: false,
              index: message.index,
            };
            return a;
          }, {}),
          [key]: {
            checked: !selected[key]?.checked,
            index: message.index,
          },
        };
      } else {
        selectedUpdate = {
          ...selected,
          [key]: {
            checked: !selected[key]?.checked,
            index: message.index,
          },
        };
      }
      const selectedEntries = Object.entries(selectedUpdate).filter(([_, v]) => v.checked).map(([k, v]) => [k, v.index]);
      selectedEntries.sort((a, b) => a[1] < b[1] ? -1 : 1);
      const selectedKeys = selectedEntries.map(x => x[0]);
      if (selectedKeys.length > 0 && selectedKeys.length < messages.length) {
        setIndeterminate(true);
      } else {
        setIndeterminate(false);
      }
      if (selectedKeys.length === messages.length) {
        setCheckAll(true);
      } else {
        setCheckAll(false);
      }
      setSelected(selectedUpdate);
      if (typeof onSelected === 'function') {
        onSelected(selectedKeys);
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
    // setLastInput(input);
    setInput(null);
    onSubmit({ app, messages: [...messages, msg] });
  };

  const regenerate = () => {
    const msg = {
      key: uuidv4(),
      role: 'user',
      content: [...messages].reverse().find(m => m.role === 'user').content,
    };
    onSubmit({ app, messages: [...messages, msg] });
  };

  const critique = () => {
    const input = messages.slice(-2)[0].content;
    const completion = messages.slice(-1)[0].content[0].content;
    onCritique({ input, completion });
  };

  const handleSuggestPrompts = () => {
    suggestPrompts({ messages });
  };

  const onCheckAllChange = (ev) => {
    if (ev.target.checked) {
      setCheckAll(true);
      const selectedUpdate = messages.reduce((a, m) => {
        if (Array.isArray(m.content)) {
          a[m.content[0].key] = {
            checked: true,
            index: m.index,
          };
        } else {
          a[m.key] = {
            checked: true,
            index: m.index,
          };
        }
        return a;
      }, {});
      setSelected(selectedUpdate);
      const selectedEntries = Object.entries(selectedUpdate).filter(([_, v]) => v.checked).map(([k, v]) => [k, v.index]);
      selectedEntries.sort((a, b) => a[1] < b[1] ? -1 : 1);
      const selectedKeys = selectedEntries.map(x => x[0]);
      if (typeof onSelected === 'function') {
        onSelected(selectedKeys);
      }
    } else {
      setCheckAll(false);
      setSelected({});
    }
    setIndeterminate(false);
  };

  const createMessages = (selectedKeys) => {
    return selectedKeys.map(key => {
      const { message, content } = findMessage(key);
      if (content) {
        return {
          role: message.role,
          content: content.content,
          key: content.key,
        };
      }
      return message;
    });
  };

  const useContent = () => {
    if (hasSelected) {
      if (typeof onUseSelected === 'function') {
        const msgs = createMessages(selectedKeys);
        onUseSelected(msgs);
      } else {
        const contents = [];
        for (const key of selectedKeys) {
          const { message, content } = findMessage(key);
          if (content) {
            contents.push({
              appId,
              contentId: uuidv4(),
              isNew: true,
              text: content.content,
              model: content.model,
              usage: message.usage,
            });
          } else {
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
      // return (
      //   <Checkbox value={message.key} onChange={onChange} checked={selected[message.key]?.checked}>
      //     <div className="chatline assistant">
      //       <div className="avatar"><Avatar>A</Avatar></div>
      //       <div className="content">
      //         <Space size="large">
      //           {message.content.map((c, i) => (
      //             <div key={c.key} className={i > 0 ? 'chat-sep' : ''}>
      //               <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>
      //               <div className="text-secondary" style={{ marginTop: 8 }}>{c.model}</div>
      //             </div>
      //           ))}
      //         </Space>
      //       </div>
      //     </div>
      //   </Checkbox>
      // );
      return (
        <div className="chatline assistant">
          <div className="avatar"><Avatar>A</Avatar></div>
          <div className="content">
            <Space size="large">
              {message.content.map((c, i) => (
                <div key={c.key} className={i > 0 ? 'chat-sep' : ''}>
                  <Checkbox value={c.key} checked={selected[c.key]?.checked}
                    onChange={onChange}
                  >
                    <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>{c.content}</Typography.Text>
                    <div className="text-secondary" style={{ marginTop: 8 }}>{c.model}</div>
                  </Checkbox>
                </div>
              ))}
            </Space>
          </div>
        </div>
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

  const UserContent = ({ message }) => {
    const { key, content } = message;
    if (Array.isArray(content)) {
      return (
        <div style={{
          alignContent: 'end',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'wrap',
          gap: 16,
          textAlign: 'end'
        }}>
          {content.map((c, i) => {
            if (c.type === 'text') {
              return (
                <div key={key + '-' + i}>
                  <Typography.Text copyable style={{ whiteSpace: 'pre-wrap' }}>
                    {c.text}
                  </Typography.Text>
                </div>
              );
            } else if (c.type === 'image_url') {
              return (
                <div key={key + '-' + i}>
                  <Image src={c.image_url.url} width={200}
                    preview={{
                      onVisibleChange: (visible) => {
                        previewVisible = visible;
                      },
                    }}
                  />
                </div>
              );
            }
          })}
        </div>
      )
    }
    return (
      <Typography.Text key={key} copyable style={{ whiteSpace: 'pre-wrap' }}>
        {content}
      </Typography.Text>
    );
  }

  const UserMessage = ({ message, onChange }) => {
    if (selectMultiple) {
      return (
        <Checkbox value={message.key} onChange={onChange} checked={selected[message.key]?.checked}>
          <div className="chatline user">
            <div className="content">
              <UserContent message={message} />
            </div>
            <div className="avatar"><Avatar>U</Avatar></div>
          </div>
        </Checkbox>
      );
    }
    return (
      <div className="chatline user">
        <div className="content">
          <UserContent message={message} />
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
    enableCritique,
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
        <Button type="primary" size="small"
          disabled={disabled || !hasMessages || !enableCritique}
          onClick={critique}
        >
          Critique
        </Button>
        {traceId ?
          <div style={{ color: '#1677ff', flex: 1, marginRight: 36, textAlign: 'end', whiteSpace: 'nowrap' }}>
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
        critique={critique}
        disabled={disabled}
        enableCritique={enableCritique}
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
        <div style={{ marginLeft: 3 }}>
          <Button type="text"
            disabled={disabled || loading || !value}
            icon={<SendOutlined />}
            onClick={handleSubmit}
          />
        </div>
      </div>
      <p className="text-secondary"
        style={{ lineHeight: '32px' }}
      >
        Press Shift+Enter to insert a new line.
      </p>
    </div>
  );
};
