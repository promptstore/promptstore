import { useMemo } from 'react';
import { Table, Typography } from 'antd';
import ReactMarkdown from 'react-markdown';

import { getExtension } from '../utils';

const { Text } = Typography;

export const ContentView = ({ loading, upload }) => {

  const { columns, dataSource, ext } = useMemo(() => {
    let ext;
    if (upload) {
      ext = getExtension(upload.filename);
      if (ext && upload.content) {
        if (ext === 'csv') {
          const content = upload.content[0];
          const columns = Object.keys(content)
            .map((col) => ({
              title: col,
              dataIndex: col,
              ellipsis: content[col].length > 50,
            }));
          const dataSource = upload.content.map((row, i) => ({ ...row, key: i }));
          return { columns, dataSource, ext };
        }
        return { ext };
      }
    }
    return {};
  }, [upload]);

  if (!upload?.content) {
    return (
      <div>Loading...</div>
    );
  }

  if (ext === 'txt') {
    return (
      <Text>
        {upload.content.split('\n').map((line, i, arr) => {
          if (i === arr.length - 1) {
            return (
              <p key={upload.id + '-' + i}>{line}...</p>
            );
          }
          return (
            <p key={upload.id + '-' + i}>{line}</p>
          );
        })}
      </Text>
    );
  }

  if (ext === 'csv') {
    return (
      <Table columns={columns} dataSource={dataSource} loading={loading} />
    );
  }

  if (ext === 'pdf' || ext === 'docx') {
    return (
      <ReactMarkdown className="markdown">{toMarkdown(upload.content.data)}</ReactMarkdown>
    );
  }

  return null;
};

const toMarkdown = (data) => {
  const md = data.structured_content.reduce((a, el) => {
    switch (el.type) {
      case 'heading':
        a.headingLevel += 1;
        a.content += '#'.repeat(a.headingLevel) + ' ' + el.text + '\n\n';
        break;

      case 'text':
        a.content += el.text + '\n\n';
        a.headingLevel = 0
        break;

      case 'list':
        const prefix = el.subtype === 'ordered' ? '1. ' : '- ';
        a.content += el.heading + '\n\n';
        el.items.forEach((li) => {
          a.content += prefix + ' ' + li + '\n';
        });
        a.content += '\n';
        a.headingLevel = 0
        break;

      default:
    }
    return a;
  }, { content: '', headingLevel: 0 });
  return md.content;
};
