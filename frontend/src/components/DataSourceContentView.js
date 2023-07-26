import { useEffect, useState } from 'react';
import { Table, Typography } from 'antd';

const { Text } = Typography;

export const DataSourceContentView = ({ dataSource }) => {

  const [previewColumns, setPreviewColumns] = useState();

  const documentType = dataSource?.documentType;

  useEffect(() => {
    if (dataSource?.content) {
      if (documentType === 'csv') {
        const content = dataSource.content[0];
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
  }, [dataSource]);

  if (!dataSource?.content) {
    return (
      <div>Loading...</div>
    );
  }

  if (documentType === 'txt') {
    return (
      <Text>
        {dataSource.content.split('\n').map((line, i, arr) => {
          if (i === arr.length - 1) {
            return (
              <p key={dataSource.id + '-' + i}>{line}...</p>
            );
          }
          return (
            <p key={dataSource.id + '-' + i}>{line}</p>
          );
        })}
      </Text>
    );
  }

  if (documentType === 'csv' && previewColumns) {
    // console.log('previewColumns:', previewColumns);
    // console.log('dataSource:', dataSource?.content);
    return (
      <Table columns={previewColumns} dataSource={dataSource.content} />
    );
  }

  return null;
};
