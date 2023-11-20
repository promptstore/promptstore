import { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Upload, message } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import { UploadsList } from './UploadsList';
import {
  fileUploadAsync,
  selectUploading,
} from './fileUploaderSlice';

const beforeUpload = (file) => {
  // console.log('file:', file);

  const isCSV = file.type === 'text/csv';

  const isText = file.type === 'text/plain';

  const isZip = file.type === 'application/zip';

  const isPdf = file.type === 'application/pdf';

  const isWord = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!(isCSV || isText || isZip || isPdf || isWord)) {
    message.error('You may only upload a CSV, Text or Zip file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 1000;

  if (!isLt2M) {
    message.error('File must smaller than 1GB.');
  }

  return (isCSV || isText || isZip || isPdf || isWord) && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};

export function FileUploader() {

  const uploading = useSelector(selectUploading);

  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace = {} } = useContext(WorkspaceContext);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Documents',
    }));
  }, []);

  const handleChange = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(fileUploadAsync(selectedWorkspace.id, info.file));
    }
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </div>
    </div>
  );
  return (
    <>
      <UploadsList workspaceId={selectedWorkspace.id} />
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Upload
          name="upload"
          listType="picture-card"
          className="avatar-uploader"
          showUploadList={false}
          customRequest={dummyRequest}
          beforeUpload={beforeUpload}
          onChange={handleChange}
        >
          {uploadButton}
        </Upload>
      </div>
    </>
  );
}
