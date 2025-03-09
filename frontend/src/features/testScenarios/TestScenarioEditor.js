import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Flex, Form, Input, Modal, Select, Skeleton, Space, Table, message } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
  PlusOutlined,
} from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import isEmpty from 'lodash.isempty';

import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import { getFunctionsAsync, selectFunctions } from '../functions/functionsSlice';
import {
  createScenarioAsync,
  generateOutputsAsync,
  getScenarioAsync,
  updateScenarioAsync,
  selectLoaded,
  selectRunning,
  selectScenarios,
} from './testScenariosSlice';

const EditableContext = createContext(null);

const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();

  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const JsonEditor = ({ value, onChange, onCancel, onSave, schema, dataIndex }) => {
  const [formData, setFormData] = useState(value);
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false);
  const [inputModalOpen, setInputModalOpen] = useState(false);

  const handleClose = () => {
    setInputModalOpen(false);
    onCancel();
  };

  const handleFullscreenClose = () => {
    setFullscreenModalOpen(false);
    onCancel();
  };

  const handleEditInput = () => {
    setInputModalOpen(true);
  };

  const handleFullscreen = () => {
    setFullscreenModalOpen(true);
  };

  const handleSave = async () => {
    onChange(formData);
    onSave();
    setInputModalOpen(false);
  };

  return (
    <>
      <Modal
        onCancel={handleClose}
        onOk={handleSave}
        open={inputModalOpen}
        title="Input"
        width={800}
        styles={{
          body: {
            maxHeight: 600,
            overflowY: 'auto',
          },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
          <Button
            type="default"
            disabled={isEmpty(formData)}
            onClick={() => {
              setFormData(null);
            }}
          >
            Clear Inputs
          </Button>
        </div>
        <SchemaForm
          formData={formData}
          onChange={ev => setFormData(ev.formData)}
          validator={validator}
          schema={schema}
          children={true}
        />
      </Modal>
      <Modal
        open={fullscreenModalOpen}
        onCancel={handleFullscreenClose}
        okButtonProps={{ style: { display: 'none' } }}
        width="100%"
        style={{ top: 0, margin: 16, padding: 0 }}
        styles={{
          body: { height: 'calc(100vh - 116px)', overflowY: 'auto' },
        }}
      >
        <JsonView src={formData} />
      </Modal>
      <Space size="small">
        {dataIndex === 'input' && (
          <Button type="text" icon={<EditOutlined />} onClick={handleEditInput}>
            JSON Editor
          </Button>
        )}
        <Button disabled={!formData} type="text" icon={<ExpandOutlined />} onClick={handleFullscreen}>
          Full-screen
        </Button>
        <Button type="text" onClick={handleClose}>
          Cancel
        </Button>
      </Space>
    </>
  );
};

const EditableCell = ({ title, editable, children, dataIndex, record, handleSave, schema, ...restProps }) => {
  const [editing, setEditing] = useState(false);

  const form = useContext(EditableContext);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({
      [dataIndex]: record[dataIndex],
    });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({
        ...record,
        ...values,
      });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{
          margin: 0,
        }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
        ]}
      >
        <JsonEditor schema={schema} onSave={save} onCancel={toggleEdit} dataIndex={dataIndex} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{
          paddingInlineEnd: 24,
        }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

export function TestScenarioEditor() {
  const { id } = useParams();

  const [func, setFunc] = useState(null);

  const loaded = useSelector(selectLoaded);
  const scenarios = useSelector(selectScenarios);
  const functions = useSelector(selectFunctions);
  const running = useSelector(selectRunning);
  const scenario = scenarios[id];

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [form] = Form.useForm();
  const functionIdValue = Form.useWatch('functionId', form);

  const functionOptions = useMemo(() => {
    const fs = Object.values(functions)
      .filter(f => f.arguments)
      .map(f => ({
        label: f.name,
        value: f.id,
      }));
    fs.sort((a, b) => a.label.localeCompare(b.label));
    return fs;
  }, [functions]);

  useEffect(() => {
    setNavbarState(state => ({
      ...state,
      createLink: null,
      title: 'Test Scenario',
    }));
    if (id !== 'new') {
      dispatch(getScenarioAsync(id));
    }
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getFunctionsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (functionIdValue) {
      setFunc(functions[functionIdValue]);
    }
  }, [functions, functionIdValue]);

  const handleInputChange = row => {
    const newData = [...(form.getFieldValue('testCases') || [])];
    const index = newData.findIndex(item => row.key === item.key);
    const item = newData[index];
    newData.splice(index, 1, {
      ...item,
      ...row,
    });
    form.setFieldValue('testCases', newData);
  };

  const handleRatingChange = (index, rating) => {
    const newData = [...(form.getFieldValue('testCases') || [])];
    newData[index] = {
      ...newData[index],
      rating,
    };
    form.setFieldValue('testCases', newData);
  };

  const handleSave = async values => {
    try {
      if (id === 'new') {
        const result = await dispatch(
          createScenarioAsync({ values: { ...values, workspaceId: selectedWorkspace.id } })
        );
        navigate(`/test-scenarios/${result.payload.id}`);
      } else {
        await dispatch(updateScenarioAsync({ values, id }));
        navigate(`/test-scenarios`);
      }
      message.success('Scenario saved successfully');
    } catch (error) {
      message.error(`Failed to save scenario: ${error.message}`);
    }
  };

  const handleAddTestCase = () => {
    form.setFieldValue('testCases', [
      ...(form.getFieldValue('testCases') || []),
      { key: uuidv4(), input: null, output: null, rating: null },
    ]);
  };

  const handleRemoveTestCase = index => {
    const newTestCases = [...(form.getFieldValue('testCases') || [])];
    newTestCases.splice(index, 1);
    form.setFieldValue('testCases', newTestCases);
  };

  const handleGenerate = async () => {
    if (id !== 'new') {
      try {
        await dispatch(generateOutputsAsync({ id, workspaceId: selectedWorkspace.id }));
        message.success('Generation completed');
      } catch (error) {
        message.error('Generation failed');
      }
    }
  };

  const onCancel = () => {
    navigate(-1);
  };

  const defaultColumns = [
    {
      title: 'Input',
      dataIndex: 'input',
      key: 'input',
      width: '40%',
      editable: true,
      render: (_, { input }) => {
        if (input) {
          return (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(input, null, 2)}
            </div>
          );
        }
        return 'No input yet';
      },
    },
    {
      title: 'Output',
      dataIndex: 'output',
      key: 'output',
      width: '40%',
      editable: true,
      render: output => {
        if (running[id]) {
          return <Skeleton active />;
        }
        if (output) {
          return (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {JSON.stringify(output, null, 2)}
            </div>
          );
        }
        return 'No output yet';
      },
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: '10%',
      render: (rating, _, index) => (
        <Space size={0}>
          <Button
            type="text"
            icon={rating === 1 ? <LikeFilled /> : <LikeOutlined />}
            onClick={() => handleRatingChange(index, 1)}
          />
          <Button
            type="text"
            icon={rating === -1 ? <DislikeFilled /> : <DislikeOutlined />}
            onClick={() => handleRatingChange(index, -1)}
          />
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '10%',
      render: (_, record, index) => (
        <Space>
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveTestCase(index)} />
        </Space>
      ),
    },
  ];

  const getColumns = () =>
    defaultColumns.map(col => {
      if (!col.editable) {
        return col;
      }
      return {
        ...col,
        onCell: record => ({
          record,
          editable: col.editable,
          dataIndex: col.dataIndex,
          title: col.title,
          handleSave: handleInputChange,
          schema: func.arguments,
        }),
      };
    });

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const TableInput = ({ value }) => {
    return (
      <Table
        components={components}
        rowClassName={() => 'editable-row'}
        bordered
        dataSource={value}
        columns={getColumns()}
        pagination={false}
      />
    );
  };

  if (!loaded) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <div id="test-scenario-editor" style={{ marginTop: 20 }}>
        <Form form={form} layout="vertical" onFinish={handleSave} initialValues={scenario}>
          <Form.Item name="name" label="Scenario Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="functionId" label="Semantic Function" rules={[{ required: true }]}>
            {id === 'new' ? (
              <Select allowClear options={functionOptions} optionFilterProp="label" />
            ) : (
              <div style={{ fontWeight: 600 }}>{func?.name}</div>
            )}
          </Form.Item>
          {func?.arguments && (
            <>
              <Form.Item
                name="testCases"
                label="Test Cases"
                extra="Click on the input or output cell for more options."
              >
                <TableInput />
              </Form.Item>
              <Form.Item>
                <Flex justify="space-between">
                  <Button type="default" icon={<PlusOutlined />} onClick={handleAddTestCase}>
                    Add Test Case
                  </Button>
                  <Button type="primary" onClick={handleGenerate}>
                    Generate
                  </Button>
                </Flex>
              </Form.Item>
            </>
          )}
          <Form.Item>
            <Space>
              <Button type="default" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit">
                Save Scenario
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </div>
    </>
  );
}
