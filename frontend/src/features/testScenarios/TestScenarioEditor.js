import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Segmented,
  Skeleton,
  Space,
  Switch,
  Table,
  message,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  LikeOutlined,
  LikeFilled,
  DislikeOutlined,
  DislikeFilled,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import Editor from '@monaco-editor/react';
import Highlighter from 'react-highlight-words';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import isEmpty from 'lodash.isempty';
import isObject from 'lodash.isobject';

import ExcelExport from '../../components/ExcelExport';
import { JsonView } from '../../components/JsonView';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import { getFunctionsAsync, selectFunctions } from '../functions/functionsSlice';
import {
  createScenarioAsync,
  generateOutputsAsync,
  generateTestCaseAsync,
  getScenarioAsync,
  updateScenarioAsync,
  selectLoaded,
  selectRunning,
  selectScenarios,
} from './testScenariosSlice';

const { TextArea } = Input;

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [formData, setFormData] = useState(value);
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false);
  const [inputModalOpen, setInputModalOpen] = useState(false);

  const editorRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

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

  const handleRawInput = () => {
    setEditorOpen(true);
  };

  const handleFullscreen = () => {
    setFullscreenModalOpen(true);
  };

  const handleSave = async () => {
    let data;
    if (typeof formData === 'string' && (formData.startsWith('{') || formData.startsWith('['))) {
      try {
        data = JSON.parse(formData);
      } catch (error) {
        message.error(`Invalid JSON input: ${error.message}`);
        return;
      }
    } else {
      data = formData;
    }
    onChange(data);
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
        onCancel={handleClose}
        onOk={dataIndex === 'input' ? handleSave : handleClose}
        open={editorOpen}
        title={dataIndex === 'input' ? 'Raw Input' : 'Raw Output'}
        width={800}
        styles={{
          body: {
            maxHeight: 600,
            overflowY: 'auto',
          },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {dataIndex === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'row-reverse' }}>
              <Button
                type="default"
                disabled={isEmpty(formData)}
                onClick={() => {
                  editorRef.current.setValue('');
                  setFormData(null);
                }}
              >
                Clear Inputs
              </Button>
            </div>
          )}
          <Editor
            height="560px"
            defaultLanguage="json"
            defaultValue={JSON.stringify(formData, null, 2)}
            onMount={handleEditorDidMount}
            onChange={setFormData}
            options={{ readOnly: dataIndex === 'output' }}
          />
        </div>
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
      {(dataIndex === 'input' || dataIndex === 'output') && (
        <Space size="small" wrap>
          {dataIndex === 'input' && (
            <>
              <Button type="text" icon={<EditOutlined />} onClick={handleEditInput}>
                JSON Editor
              </Button>
            </>
          )}
          <Button type="text" icon={<EditOutlined />} onClick={handleRawInput}>
            Raw JSON {dataIndex === 'input' ? 'Input' : 'Output'}
          </Button>
          <Button disabled={!formData} type="text" icon={<ExpandOutlined />} onClick={handleFullscreen}>
            Full-screen
          </Button>
          <Button type="text" onClick={handleClose}>
            Cancel
          </Button>
        </Space>
      )}
      {(dataIndex === 'description' || dataIndex === 'notes') && (
        <Flex gap={8} style={{ width: '100%' }}>
          <TextArea autoSize={{ minRows: 1, maxRows: 10 }} onChange={ev => setFormData(ev.target.value)} />
          <Space>
            <Button type="text" icon={<CheckOutlined />} onClick={handleSave} />
            <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
          </Space>
        </Flex>
      )}
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
  const params = useParams();
  let id;
  if (params.id === 'new') {
    id = params.id;
  } else {
    id = parseInt(params.id, 10);
  }

  const [func, setFunc] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const loaded = useSelector(selectLoaded);
  const scenarios = useSelector(selectScenarios);
  const functions = useSelector(selectFunctions);
  const running = useSelector(selectRunning);
  const scenario = scenarios[id];

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const searchInput = useRef(null);

  const [form] = Form.useForm();
  const functionIdValue = Form.useWatch('functionId', form);

  const functionOptions = useMemo(() => {
    const fs = Object.values(functions)
      .filter(f => f.arguments?.type === 'object' && f.returnTypeSchema?.type === 'object')
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

  useEffect(() => {
    if (scenario) {
      form.setFieldsValue(scenario);
    }
  }, [scenario]);

  const handleReset = clearFilters => {
    setSearchText('');
    setSearchedColumn('');
  };

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    // console.log('handleSearch - selectedKeys:', selectedKeys);
    // console.log('handleSearch - dataIndex:', dataIndex);
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const getColumnSearchProps = dataIndex => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }} onKeyDown={ev => ev.stopPropagation()}>
        <Input
          allowClear
          ref={searchInput}
          placeholder={`Search ${dataIndex}`}
          value={selectedKeys[0]}
          onChange={ev => {
            if (ev.target.value) {
              setSelectedKeys([ev.target.value]);
            } else {
              clearFilters && handleReset(clearFilters);
              handleSearch(selectedKeys, confirm, dataIndex);
              setSelectedKeys([]);
              setSearchText('');
              setSearchedColumn('');
            }
          }}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" onClick={() => handleSearch(selectedKeys, confirm, dataIndex)} size="small">
            Search
          </Button>
          <Button onClick={() => clearFilters && handleReset(clearFilters)} size="small">
            Reset
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="link" size="small" onClick={() => close()}>
            close
          </Button>
        </div>
      </div>
    ),
    filterIcon: filtered => <SearchOutlined style={{ color: filtered ? '1677ff' : undefined }} />,
    onFilter: (value, record) => {
      console.log('onFilter -', dataIndex, ':', value);
      return record[dataIndex].toString().toLowerCase().includes(value.toLowerCase());
    },
    onFilterDropdownOpenChange: visible => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: text =>
      searchedColumn === dataIndex ? (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ) : (
        text
      ),
  });

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
        navigate(`/test-scenarios/${result.id}`);
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

  const handleCopySelected = () => {
    const testCases = form.getFieldValue('testCases') || [];
    const selectedTestCase = testCases.find(tc => selectedRowKeys.includes(tc.key));
    if (!selectedTestCase) {
      message.error('No test case selected');
      return;
    }
    const newTestCase = {
      key: uuidv4(),
      input: selectedTestCase.input,
      output: selectedTestCase.output,
      rating: null,
    };
    form.setFieldValue('testCases', [...(form.getFieldValue('testCases') || []), newTestCase]);
  };

  const handleGenerateTestCase = async () => {
    const testCases = form.getFieldValue('testCases') || [];
    const selectedTestCase = testCases.find(tc => selectedRowKeys.includes(tc.key));
    if (!selectedTestCase) {
      message.error('No test case selected');
      return;
    }
    const result = await dispatch(
      generateTestCaseAsync({
        exampleInput: selectedTestCase.input,
        functionId: selectedTestCase.functionId,
        workspaceId: selectedWorkspace.id,
      })
    );
    const newTestCase = {
      key: uuidv4(),
      description: result.testCaseName,
      input: result.input,
      output: null,
      rating: null,
    };
    console.log('newTestCase:', newTestCase);
    form.setFieldValue('testCases', [...(form.getFieldValue('testCases') || []), newTestCase]);
  };

  const handleRemoveTestCase = index => {
    const newTestCases = [...(form.getFieldValue('testCases') || [])];
    newTestCases.splice(index, 1);
    form.setFieldValue('testCases', newTestCases);
  };

  const handleDeleteSelected = () => {
    const testCases = form.getFieldValue('testCases') || [];
    const newTestCases = testCases.filter(tc => !selectedRowKeys.includes(tc.key));
    form.setFieldValue('testCases', newTestCases);
    setSelectedRowKeys([]);
    message.success(`${selectedRowKeys.length} test case(s) deleted successfully`);
  };

  const handleGenerate = async () => {
    if (id !== 'new') {
      try {
        const values = await form.validateFields();
        await dispatch(
          generateOutputsAsync({ id, workspaceId: selectedWorkspace.id, values, selectedRowKeys })
        );
        // message.success('Generation completed');
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
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: '26%',
      editable: true,
      ...getColumnSearchProps('description'),
      render: (_, { description }) => {
        if (searchedColumn === 'description') {
          return (
            <Highlighter
              autoEscape
              highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
              searchWords={[searchText]}
              textToHighlight={description}
            />
          );
        } else {
          if (description) {
            return (
              <div
                style={{
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {description}
              </div>
            );
          }
          return 'Describe the test objective';
        }
      },
    },
    {
      title: 'Input',
      dataIndex: 'input',
      key: 'input',
      width: '27%',
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
      width: '27%',
      editable: true,
      render: (_, { key, output }) => {
        if (running[id] && (selectedRowKeys.includes(key) || selectedRowKeys.length === 0)) {
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
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      width: '19%',
      editable: true,
      render: (_, { notes }) => {
        if (notes) {
          return (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {notes}
            </div>
          );
        }
        return 'Notes on results';
      },
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 55,
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
      title: 'Created',
      dataIndex: 'created',
      key: 'created',
      width: 55,
      render: (_, { created }) => (created ? new Date(created).toLocaleDateString() : ''),
      showSorterTooltip: { target: 'full-header' },
      sorter: (a, b) => (a.created < b.created ? -1 : 1),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Updated',
      dataIndex: 'modified',
      key: 'modified',
      width: 55,
      render: (_, { modified }) => (modified ? new Date(modified).toLocaleDateString() : ''),
      showSorterTooltip: { target: 'full-header' },
      sorter: (a, b) => (a.modified < b.modified ? -1 : 1),
      sortDirections: ['ascend', 'descend'],
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 55,
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

  const onSelectChange = newSelectedRowKeys => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const hasSelected = selectedRowKeys.length > 0;

  const TableInput = ({ value }) => {
    const defaultSorted = [...(value || [])]
      .filter(row => row)
      .map(row => ({ ...row, description: row.description || '' }));

    defaultSorted.sort((a, b) => (a.created < b.created ? -1 : 1));
    return (
      <Table
        components={components}
        rowClassName={() => 'editable-row'}
        bordered
        dataSource={defaultSorted}
        columns={getColumns()}
        pagination={false}
        rowSelection={rowSelection}
      />
    );
  };

  const getObjectListProperty = obj => {
    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        return key;
      }
    }
    return null;
  };

  const exportedData = scenario?.testCases
    ?.filter(c => selectedRowKeys.includes(c.key) && c.output)
    .map(c => c.output)
    .flatMap(output => {
      if (isObject(output)) {
        const listProperty = getObjectListProperty(output);
        if (listProperty) {
          return output[listProperty]?.map(item => flattenObject(item));
        }
        return [flattenObject(output)];
      }
      return [output];
    });

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
          <Form.Item name="purpose" label="Purpose">
            <TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
          </Form.Item>
          <Form.Item>
            <Form.Item
              name="batched"
              label="Batched"
              extra="Are inputs sent as a group?"
              style={{ display: 'inline-block', marginBottom: 0, width: 192 }}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="batchMethod"
              label="Batching Method"
              extra="How are inputs batched?"
              style={{ display: 'inline-block', marginBottom: 0, width: 'calc(100% - 192px)' }}
            >
              <Input placeholder="e.g. All children of parent element up to context limit." />
            </Form.Item>
          </Form.Item>
          <Form.Item label="Other Operational Requirements" name="operationalRequirements">
            <TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="active">
            <Segmented
              options={[
                {
                  value: 'active',
                  label: 'Active',
                },
                {
                  value: 'archived',
                  label: 'Archived',
                },
              ]}
            />
          </Form.Item>
          <Form.Item name="functionId" label="Semantic Function" rules={[{ required: true }]}>
            {id === 'new' ? (
              <Select allowClear options={functionOptions} optionFilterProp="label" />
            ) : (
              <div style={{ fontWeight: 600 }}>{func?.name}</div>
            )}
          </Form.Item>
          {id !== 'new' && func && (
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
                  <Flex gap={8}>
                    <Button type="default" icon={<PlusOutlined />} onClick={handleAddTestCase}>
                      Add Test Case
                    </Button>
                    <Button
                      disabled={selectedRowKeys.length !== 1}
                      type="default"
                      icon={<CopyOutlined />}
                      onClick={handleCopySelected}
                    >
                      Copy Selected
                    </Button>
                    <Button
                      disabled={selectedRowKeys.length !== 1}
                      type="default"
                      icon={<ThunderboltOutlined />}
                      onClick={handleGenerateTestCase}
                    >
                      Generate Test Case
                    </Button>
                    <Button
                      disabled={!hasSelected}
                      type="default"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteSelected}
                    >
                      Delete Selected
                    </Button>
                  </Flex>
                  <Flex gap={8}>
                    <ExcelExport
                      data={exportedData}
                      filename={'export'}
                      buttonType="primary"
                      disabled={!hasSelected}
                    />
                    <Button type="primary" onClick={handleGenerate}>
                      {hasSelected ? 'Run Selected' : 'Run All'}
                    </Button>
                  </Flex>
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

function flattenObject(obj) {
  var result = {};
  function recurse(cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      for (var i = 0, l = cur.length; i < l; i++) recurse(cur[i], prop + '[' + i + ']');
      if (l == 0) result[prop] = [];
    } else {
      var isEmpty = true;
      for (var p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? prop + '.' + p : p);
      }
      if (isEmpty && prop) result[prop] = {};
    }
  }
  recurse(obj, '');
  return result;
}
