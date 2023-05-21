import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, DatePicker, Form, Input, Space } from 'antd';
import { MinusCircleOutlined } from '@ant-design/icons';
import * as dayjs from 'dayjs';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';

import {
  createAppAsync,
  generateBriefAsync,
  getAppAsync,
  selectApps,
  selectBrief,
  selectLoaded,
  selectLoadingBrief,
  updateAppAsync,
} from './appsSlice';
import { AppModalForm } from './AppModalForm';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const layout = {
  labelCol: { span: 4 },
  wrapperCol: { span: 20 },
};

const getFeatureLength = (featureValues) => {
  let n = 0;
  for (const v of Object.values(featureValues)) {
    if (Array.isArray(v)) {
      if (v.length > 0) {
        n += 1;
      }
    } else {
      if (v !== null && typeof v !== 'undefined') {
        n += 1;
      }
    }
  }
  return n;
};

const brandOptions = [
  {
    label: 'BT',
    value: 'BT',
  },
  {
    label: 'EE',
    value: 'EE',
  },
];

export function AppForm() {

  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [featureValues, setFeatureValues] = useState(null);

  const [form] = Form.useForm();

  const featuresFormResetCallbackRef = useRef();

  const loaded = useSelector(selectLoaded);
  const apps = useSelector(selectApps);

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const id = location.pathname.match(/\/apps\/(.*)/)[1];
  const isNew = id === 'new';

  const selectedFeatures =
    featureValues ? getFeatureLength(featureValues) + ' features' : '';

  const app = useMemo(() => {
    const a = apps[id];
    if (a) {
      const now = new Date();
      const [startDate, endDate] = a.dateRange || [null, null];
      const dateRange = [dayjs(startDate || now), dayjs(endDate || now)];
      return { ...a, dateRange };
    }
    return [];
  }, [apps]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'App',
    }));
    if (!isNew) {
      dispatch(getAppAsync(id));
    }
  }, []);

  useEffect(() => {
    if (app.features) {
      setFeatureValues(app.features);
    }
  }, [apps]);

  const handleFeaturesCancel = () => {
    setIsFeaturesModalOpen(false);
  };

  const handleFeaturesSet = (values) => {
    setIsFeaturesModalOpen(false);
    setFeatureValues(values);
  };

  const onCancel = () => {
    navigate('/apps');
  };

  const onFinish = (values) => {
    if (isNew) {
      dispatch(createAppAsync({
        values: {
          ...values,
          workspaceId: selectedWorkspace.id,
          features: featureValues,
          dateRange: [values.dateRange?.[0].format('YYYY-MM-DD'), values.dateRange?.[1].format('YYYY-MM-DD')],
        }
      }));
    } else {
      dispatch(updateAppAsync({
        id,
        values: {
          ...values,
          features: featureValues,
          dateRange: [values.dateRange?.[0].format('YYYY-MM-DD'), values.dateRange?.[1].format('YYYY-MM-DD')],
        }
      }));
    }
    navigate('/apps');
  };

  const playground = () => {
    navigate(`/playground/${app.id}`);
  };

  const registerFeaturesResetCallback = (callback) => {
    featuresFormResetCallbackRef.current = callback;
  };

  const unsetFeatures = () => {
    setFeatureValues(null);
    featuresFormResetCallbackRef.current();
  };

  if (!isNew && !loaded) {
    return (
      <div style={{ marginTop: 20 }}>Loading...</div>
    );
  }
  return (
    <>
      <AppModalForm
        open={isFeaturesModalOpen}
        onOk={handleFeaturesSet}
        onCancel={handleFeaturesCancel}
        registerResetCallback={registerFeaturesResetCallback}
        values={app.features}
      />
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex' }}>
          <div style={{ marginLeft: 'auto' }}>
            <Space>
              {/* <Button type="link"
                disabled={isNew}
                onClick={playground}
              >
                Creative Workspace
              </Button> */}
            </Space>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <Form
            form={form}
            {...layout}
            name="app"
            autoComplete="off"
            onFinish={onFinish}
            initialValues={app}
          >
            <Form.Item
              label="Name"
              name="name"
              rules={[
                {
                  required: true,
                  message: 'Please enter a app name',
                },
              ]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Description"
              name="description"
            >
              <TextArea
                autoSize={{ minRows: 3, maxRows: 14 }}
              />
            </Form.Item>
            {/* <Form.Item
              label="Primary Features"
              name="features"
            >
              <Space>
                <Button type="default"
                  onClick={() => setIsFeaturesModalOpen(true)}
                >
                  Set
                </Button>
                <div>{selectedFeatures}</div>
                {selectedFeatures &&
                  <Button type="text"
                    icon={<MinusCircleOutlined />}
                    style={{ color: 'rgb(136, 136, 136)' }}
                    title="Unset"
                    onClick={unsetFeatures}
                  />
                }
              </Space>
            </Form.Item> */}
            <Form.Item wrapperCol={{ ...layout.wrapperCol, offset: 4 }}>
              <Space>
                <Button type="default" onClick={onCancel}>Cancel</Button>
                <Button type="primary" htmlType="submit">Submit</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </div>
    </>
  );
};