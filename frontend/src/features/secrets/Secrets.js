import React, { useContext, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Form, Input, Space, Table } from 'antd';
import useLocalStorageState from 'use-local-storage-state';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  createSecretAsync,
  deleteSecretsAsync,
  getSecretsAsync,
  selectLoading,
  selectSecrets,
  updateSecretAsync,
} from './secretsSlice';

const EditableContext = React.createContext(null);

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

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {

  const [editing, setEditing] = useState(false);

  const inputRef = useRef(null);

  const form = useContext(EditableContext);

  useEffect(() => {
    if (editing) {
      inputRef.current.focus();
    }
  }, [editing]);

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
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{
          paddingRight: 24,
        }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};

export function Secrets() {

  const [newCount, setNewCount] = useState(1);
  const [dataSource, setDataSource] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [page, setPage] = useLocalStorageState('secrets-list-page', { defaultValue: 1 });

  const loading = useSelector(selectLoading);
  const secrets = useSelector(selectSecrets);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Secrets',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getSecretsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    const list = Object.values(secrets).map((s) => ({
      key: s.id,
      name: s.name,
      value: s.value,
    }));
    list.sort((a, b) => a.name < b.name ? -1 : 1);
    setDataSource(list);
  }, [secrets]);

  const onDelete = () => {
    dispatch(deleteSecretsAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const defaultColumns = [
    {
      title: 'Key',
      dataIndex: 'name',
      editable: true,
      width: 350,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      editable: true,
      render: () => (
        <div>
          &#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;
        </div>
      ),
    },
    // {
    //   title: 'Action',
    //   key: 'action',
    //   fixed: 'right',
    //   width: 225,
    //   render: (_, record) => (
    //     <Space size="middle">
    //       <Button type="link"
    //         style={{ paddingLeft: 0 }}
    //         onClick={() => { }}
    //       >
    //         Edit
    //       </Button>
    //     </Space>
    //   ),
    // },
  ];

  const handleAdd = () => {
    const newData = {
      key: 'new' + newCount,
      name: `Untitled ${newCount}`,
      value: 'changeme',
    };
    setDataSource([...dataSource, newData]);
    setNewCount(newCount + 1);
  };

  const handleSave = (row) => {
    console.log('row:', row);
    const values = {
      name: row.name,
      value: row.value,
      workspaceId: selectedWorkspace.id,
    }
    if (row.key.toString().startsWith('new')) {
      dispatch(createSecretAsync({ values }));
    } else {
      dispatch(updateSecretAsync({ id: row.key, values }));
    }
    setNewCount(1);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  const components = {
    body: {
      row: EditableRow,
      cell: EditableCell,
    },
  };

  const columns = defaultColumns.map((col) => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record) => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave,
      }),
    };
  });

  const hasSelected = selectedRowKeys.length > 0;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
            Delete
          </Button>
          {hasSelected ?
            <span>
              Selected {selectedRowKeys.length} items
            </span>
            : null
          }
        </div>
        <Button
          onClick={handleAdd}
          type="primary"
        >
          Create Secret
        </Button>
      </div>
      <Table
        rowSelection={rowSelection}
        rowClassName={() => 'editable-row'}
        components={components}
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={{
          current: page,
          onChange: (page, pageSize) => setPage(page),
        }}
      />
    </div>
  );
}