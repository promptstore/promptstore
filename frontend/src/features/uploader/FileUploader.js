import { useContext, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Form, Upload, message } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import FileUploadForm from './FileUploadForm';
import {
  fileUploadAsync,
  selectUploading,
} from './fileUploaderSlice';
import { UploadsList } from './UploadsList';

const beforeUpload = (file) => {
  console.log('file:', file);

  const isCSV = file.type === 'text/csv';

  const isText = file.type === 'text/plain';

  const isZip = file.type === 'application/zip';

  if (!(isCSV || isText || isZip)) {
    message.error('You may only upload a CSV, Text or Zip file.');
  }

  const isLt2M = file.size / 1024 / 1024 < 100;

  if (!isLt2M) {
    message.error('File must smaller than 100MB.');
  }

  return (isCSV || isText || isZip) && isLt2M;
};

// https://stackoverflow.com/questions/51514757/action-function-is-required-with-antd-upload-control-but-i-dont-need-it
const dummyRequest = ({ file, onSuccess }) => {
  setTimeout(() => {
    onSuccess('ok');
  }, 20);
};

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

export function FileUploader() {

  const [form] = Form.useForm();
  const [formDirty, setFormDirty] = useState(false);
  const [formValues, setFormValues] = useState(null);

  const uploading = useSelector(selectUploading);
  const navigate = useNavigate();

  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace = {} } = useContext(WorkspaceContext);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Corpora',
    }));
  }, []);

  const handleChange = (info) => {
    if (info.file.status === 'uploading') {
      return;
    }
    if (info.file.status === 'done') {
      dispatch(fileUploadAsync(info.file, selectedWorkspace));
    }
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div
        style={{
          marginTop: 8,
        }}
      >
        {uploading ? 'Uploading...' : 'Upload'}
      </div>
    </div>
  );

  return (
    <>
      <UploadsList sourceId={selectedWorkspace.id} />
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
