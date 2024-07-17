import { memo, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Modal } from 'antd';
import { Handle, Position } from 'reactflow';

import { ContentView } from '../../components/ContentView';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getUploadContentAsync,
  selectLoading,
  selectUploads,
} from '../uploader/fileUploaderSlice';

export default memo(({ id, data, isConnectable }) => {

  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const loading = useSelector(selectLoading);
  const uploads = useSelector(selectUploads);

  const dispatch = useDispatch();

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const sourceUploads = uploads[selectedWorkspace.id] || [];

  const upload = useMemo(() => {
    if (!selectedId) return null;
    return sourceUploads.find((doc) => doc.id === selectedId);
  }, [selectedId, uploads]);

  useEffect(() => {
    if (selectedId && !upload?.content) {
      dispatch(getUploadContentAsync(selectedWorkspace.id, selectedId, 1000 * 1024));
    }
  }, [selectedId, upload]);

  const onCancel = () => {
    setModalOpen(false);
  };

  const showContent = (id) => {
    setSelectedId(id);
    setModalOpen(true);
  };

  return (
    <>
      <Modal
        open={isModalOpen}
        title="Content Preview"
        width={'75%'}
        styles={{
          body: { height: 500, overflowY: 'auto' },
        }}
        onCancel={onCancel}
        okButtonProps={{ style: { display: 'none' } }}
        cancelText="Close"
      >
        <ContentView upload={upload} loading={loading} />
      </Modal>
      <div className="custom-node__header">
        <div style={{ display: 'flex' }}>
          {data.label}
          <div style={{ flex: 1 }}></div>
          {data.uploadId ?
            <Link
              onClick={() => showContent(data.uploadId)}
            >
              Preview
            </Link>
            : null
          }
        </div>
      </div>
      <div className="custom-node__body">
        {data.objectName}
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
