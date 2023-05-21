import { useState } from 'react';
import { Button, Image, Input, Typography } from 'antd';
import { LikeFilled, LikeOutlined } from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const { TextArea } = Input;
const { Text } = Typography;

export function CopyColumn({ editValue, like, likes, onChangeRowCopy, recordKey, text }) {

  const [copied, setCopied] = useState({});

  const onCopy = (key) => {
    setCopied((state) => ({ ...state, [key]: true }));
    setTimeout(() => {
      setCopied((state) => ({ ...state, [key]: false }));
    }, 3000);
  };

  if (text.startsWith('http')) {
    return (
      <Image src={text} width={300} />
    );
  }
  if (editValue) {
    return (
      <TextArea
        autoSize={{ minRows: 2, maxRows: 14 }}
        onChange={(ev) => onChangeRowCopy(recordKey, ev.target.value)}
        value={editValue}
      />
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div>
        <Text>
          {text}
          {copied[recordKey] &&
            <span
              style={{ color: '#888', fontSize: '0.85em', marginLeft: 8 }}
            >
              Copied!
            </span>
          }
        </Text>
      </div>
      <div style={{ marginLeft: 12, width: 12 }}>
        <CopyToClipboard
          onCopy={() => onCopy(recordKey)}
          text={text}
        >
          <button
            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.85em' }}
            title="Copy to clipboard"
          >
            <i className="icon-copy" />
          </button>
        </CopyToClipboard>
      </div>
      {/* <div style={{ marginLeft: 8, paddingBottom: 3 }}>
        <Button type="text"
          icon={likes ? <LikeFilled /> : <LikeOutlined />}
          onClick={() => like(recordKey)}
          size="small"
          title="Like - add to training data"
        />
      </div> */}
    </div>
  );
}