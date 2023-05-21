import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Modal, Table, Typography } from 'antd';
import hr from '@tsmx/human-readable';

import { getHumanFriendlyDelta } from '../../utils';
import {
  deleteUploadsAsync,
  getUploadContentAsync,
  getUploadsAsync,
  selectLoading,
  selectUploaded,
  selectUploads,
} from './fileUploaderSlice';

const { Text } = Typography;

export function UploadsList({ sourceId }) {

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loading = useSelector(selectLoading);
  const uploaded = useSelector(selectUploaded);
  const uploads = useSelector(selectUploads);
  const sourceUploads = uploads[sourceId] || [];

  const data = useMemo(() => sourceUploads.map((upload) => ({
    key: upload.etag,
    id: upload.id,
    name: upload.name,
    size: upload.size,
    lastModified: upload.lastModified,
  })), [uploads]);

  // const upload = useMemo(() => {
  //   return sourceUploads.find((u) => u.id === selectedId);
  // }, [selectedId, uploads]);

  const upload = sourceUploads.find((u) => u.id === selectedId);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getUploadsAsync({ sourceId }));
  }, []);

  useEffect(() => {
    if (uploaded) {
      dispatch(getUploadsAsync({ sourceId }));
    }
  }, [uploaded]);

  useEffect(() => {
    if (selectedId && !upload.content) {
      dispatch(getUploadContentAsync(sourceId, selectedId));
    }
  }, [selectedId]);

  const onCancel = () => {
    setIsModalOpen(false);
    setSelectedId(null);
  };

  const onDelete = () => {
    const deleteList = [];
    for (const key of selectedRowKeys) {
      const found = sourceUploads.find((u) => u.etag === key);
      if (found) {
        deleteList.push(found);
      }
    }
    dispatch(deleteUploadsAsync({ sourceId, uploads: deleteList }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const showContent = (id) => {
    setSelectedId(id);
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      width: '100%',
      render: (_, { id, name }) => (
        <a href='#'
          onClick={() => showContent(id)}
        >
          {name.match(`${sourceId}/(.*)`)[1]}
        </a>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      render: (_, { size }) => (
        <span style={{ whiteSpace: 'nowrap' }}>{hr.fromBytes(size)}</span>
      ),
      className: 'col-hdr-nowrap',
    },
    {
      title: 'Last Modified',
      dataIndex: 'lastModified',
      render: (_, { lastModified }) => (
        <span style={{ whiteSpace: 'nowrap' }}>{getHumanFriendlyDelta(lastModified)}</span>
      ),
      className: 'col-hdr-nowrap',
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <>
      <Modal
        open={isModalOpen}
        title="Content"
        width={800}
        bodyStyle={{ height: 500, overflowY: 'auto' }}
        onCancel={onCancel}
        onOk={onCancel}
      >
        {upload && upload.content ?
          <Text>
            {upload.content.split('\n').map((line, i) => (
              <p key={selectedId + '-' + i}>{line}</p>
            ))}
          </Text>
          :
          <div>Loading...</div>
        }
      </Modal>
      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <Button danger type="primary" disabled={!hasSelected} onClick={onDelete}>
            Delete
          </Button>
          <span style={{ marginLeft: 8 }}>
            {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
          </span>
        </div>
        <Table rowSelection={rowSelection} columns={columns} dataSource={data} />
      </div>
    </>
  );
};
