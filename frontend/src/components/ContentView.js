import { useEffect, useState } from 'react';
import { Table, Typography } from 'antd';

import { getExtension } from '../utils';

const { Text } = Typography;

export const ContentView = ({ upload }) => {

  // console.log('upload:', upload);

  const [previewColumns, setPreviewColumns] = useState();

  const ext = getExtension(upload?.filename);

  useEffect(() => {
    if (upload?.content) {
      if (ext === 'csv') {
        const content = upload.content[0];
        const columns = Object.keys(content)
          .map((col) => ({
            title: col,
            dataIndex: col,
            ellipsis: content[col].length > 50,
          }))
          ;
        setPreviewColumns(columns);
      }
    }
  }, [upload, ext]);

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

  if (ext === 'csv' && previewColumns) {
    // console.log('previewColumns:', previewColumns);
    // console.log('dataSource:', upload?.content);
    return (
      <Table columns={previewColumns} dataSource={upload.content} />
    );
  }

  return null;
};
