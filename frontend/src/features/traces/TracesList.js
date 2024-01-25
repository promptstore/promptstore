import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, DatePicker, Input, Slider, Space, Table, Tag, message } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  DownloadOutlined,
  FieldNumberOutlined,
  RedoOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import Highlighter from 'react-highlight-words';
import useLocalStorageState from 'use-local-storage-state';
import * as dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import Download from '../../components/Download';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';

import {
  deleteTracesAsync,
  getTracesAsync,
  selectTraces,
  selectLoading,
} from './tracesSlice';

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const { RangePicker } = DatePicker;

const TIME_FORMAT = 'YYYY-MM-DDTHH-mm-ss';

export function TracesList() {

  const [page, setPage] = useLocalStorageState('traces-list-page', { defaultValue: 1 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [tableParams, setTableParams] = useState({
    pagination: {
      current: 1,
      pageSize: 10,
    },
  });
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');

  const traces = useSelector(selectTraces);
  const loading = useSelector(selectLoading);

  // console.log('traces:', traces);

  const fetchData = () => {
    // onRefresh();
  };

  const data = useMemo(() => {
    const list = Object.values(traces).map((trace) => ({
      key: trace.id,
      name: trace.name,
      traceType: trace.traceType,
      created: trace.created,
      success: trace.trace[0].success,
      latency: trace.trace[0].elapsedMillis,
      tokens: trace.trace[0].response?.usage?.total_tokens,
      username: trace.createdBy,
    }));
    list.sort((a, b) => a.created > b.created ? -1 : 1);
    return list;
  }, [traces]);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const searchInput = useRef(null);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'Traces',
    }));
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      onRefresh();
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 5,
      });
    }
  }, [location]);

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(tableParams)]);

  const onDelete = () => {
    dispatch(deleteTracesAsync({ ids: selectedRowKeys }));
    setSelectedRowKeys([]);
  };

  const onRefresh = () => {
    const workspaceId = selectedWorkspace.id;
    dispatch(getTracesAsync({ workspaceId }));
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleSearch = (selectedKeys, confirm, dataIndex) => {
    // console.log('handleSearch - selectedKeys:', selectedKeys);
    // console.log('handleSearch - dataIndex:', dataIndex);
    confirm();
    setSearchText(selectedKeys[0]);
    setSearchedColumn(dataIndex);
  };

  const handleReset = (clearFilters) => {
    clearFilters();
    setSearchText('');
  };

  const getColumnSearchProps = (dataIndex) => ({
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
            }
          }}
          onPressEnter={() => handleSearch(selectedKeys, confirm, dataIndex)}
          style={{ marginBottom: 8 }}
        />
        <div style={{ display: 'flex' }}>
          <Button type="primary"
            onClick={() => handleSearch(selectedKeys, confirm, dataIndex)}
            size="small"
          >
            Search
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="link"
            size="small"
            onClick={() => close()}
          >
            close
          </Button>
        </div>
      </div>
    ),
    filterIcon: (filtered) => (
      <SearchOutlined style={{ color: filtered ? '1677ff' : undefined }} />
    ),
    onFilter: (value, record) => {
      // console.log('onFilter -', dataIndex, ':', value);
      return record[dataIndex].toString().toLowerCase().includes(value.toLowerCase());
    },
    onFilterDropdownOpenChange: (visible) => {
      if (visible) {
        setTimeout(() => searchInput.current?.select(), 100);
      }
    },
    render: (text) => searchedColumn === dataIndex ? (
      <Highlighter
        highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
        searchWords={[searchText]}
        autoEscape
        textToHighlight={text ? text.toString() : ''}
      />
    ) : text,
  });

  const getDateRangeProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }}>
        <RangePicker
          onChange={dates => {
            if (dates) {
              // console.log('onChange:', dates);
              setSelectedKeys([dates]);
            } else {
              clearFilters();
              setSelectedKeys([]);
            }
          }}
          style={{ marginBottom: 8 }}
        />
        <div>
          <Button type="primary"
            onClick={() => confirm()}
            size="small"
          >
            Filter
          </Button>
        </div>
      </div>
    ),
    filterIcon: (filtered) => (
      <CalendarOutlined style={{ color: filtered ? '1677ff' : undefined }} />
    ),
    onFilter: (value, record) => {
      // console.log('onFilter -', dataIndex, ':', value);
      // console.log('onFilter -', dataIndex, ':', value[0].format('YYYY-MM-DD'), '-', value[1].format('YYYY-MM-DD'));
      // console.log('record:', record);
      // console.log('value:', record[dataIndex]);
      const dt = dayjs(record[dataIndex]).startOf('day');
      // console.log(dataIndex, ':', dt.format('YYYY-MM-DD'));
      const filter = dt.isSameOrAfter(value[0]) && dt.isSameOrBefore(value[1]);
      // console.log('filter:', filter);
      return filter;
    },
  });

  const getNumberRangeProps = (dataIndex) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters, close }) => (
      <div style={{ padding: 8 }}>
        <Slider range
          min={0}
          max={30000}
          onChange={values => {
            if (values) {
              // console.log('onChange:', values);
              setSelectedKeys([values]);
            } else {
              clearFilters();
              setSelectedKeys([]);
            }
          }}
          style={{ marginBottom: 8 }}
        />
        <Space>
          <Button type="primary"
            onClick={() => confirm()}
            size="small"
          >
            Filter
          </Button>
          <Button type="primary"
            onClick={() => {
              clearFilters();
              setSelectedKeys([]);
              confirm();
            }}
            size="small"
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => (
      <FieldNumberOutlined style={{ color: filtered ? '1677ff' : undefined }} />
    ),
    onFilter: (value, record) => {
      console.log('onFilter -', dataIndex, ':', value);
      console.log('record:', record);
      console.log('value:', record[dataIndex]);
      const num = record[dataIndex];
      const filter = num >= value[0] && num <= value[1];
      console.log('filter:', filter);
      return filter;
    },
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      ...getColumnSearchProps('name'),
      render: (_, { key, name }) => searchedColumn === 'name' ? (
        <div style={{ minWidth: 250 }}>
          <Link to={`/traces/${key}`}>
            <Highlighter
              autoEscape
              highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
              searchWords={[searchText]}
              textToHighlight={name}
            />
          </Link>
        </div>
      ) : (
        <div style={{ minWidth: 250 }}>
          <Link to={`/traces/${key}`}>
            {name}
          </Link>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'traceType',
      render: (_, { traceType }) => (
        <Tag>{traceType}</Tag>
      ),
      filters: [
        {
          text: 'chat',
          value: 'chat',
        },
        {
          text: 'semfn',
          value: 'semfn',
        },
      ],
      onFilter: (value, record) => record.traceType.indexOf(value) === 0,
      sorter: (a, b) => a.traceType.length - b.traceType.length,
      sortDirections: ['descend'],
    },
    {
      title: 'Run',
      dataIndex: 'created',
      render: (_, { created }) => (
        <span>{dayjs(created).format(TIME_FORMAT)}</span>
      ),
      ...getDateRangeProps('created'),
    },
    {
      title: 'Success',
      dataIndex: 'success',
      align: 'center',
      render: (_, { success }) =>
        success ? (
          <div className="success">
            <CheckCircleFilled />
          </div>
        ) : (
          <div className="failure">
            <CloseCircleFilled />
          </div>
        ),
      filters: [
        {
          text: 'Success',
          value: true,
        },
        {
          text: 'Failure',
          value: false,
        },
      ],
      onFilter: (value, record) => record.success === value,
    },
    {
      title: 'Latency',
      dataIndex: 'latency',
      render: (_, { latency }) => {
        if (latency && latency > 0) {
          const secs = latency / 1000;
          const color = secs > 5 ? 'red' : 'green';
          return (
            <Tag
              icon={<ClockCircleOutlined />}
              color={color}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {secs.toLocaleString('en-US')}s
            </Tag>
          );
        }
        return null;
      },
      ...getNumberRangeProps('latency'),
    },
    {
      title: 'Tokens',
      dataIndex: 'tokens',
      align: 'right',
      render: (_, { tokens }) => (
        <span>{tokens?.toLocaleString('en-US')}</span>
      )
    },
    {
      title: 'Username',
      dataIndex: 'username',
      render: (_, { username }) => (
        <span>{username}</span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => navigate(`/traces/${record.key}`)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination, filters, sorter) => {
    setTableParams({
      pagination,
      filters,
      ...sorter,
    });

    // `dataSource` is useless since `pageSize` changed
    // if (pagination.pageSize !== tableParams.pagination?.pageSize) {
    //   setData([]);
    // }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    // selections: [
    //   Table.SELECTION_ALL,
    // ],
  };

  const hasSelected = selectedRowKeys.length > 0;

  const selectedTraces = selectedRowKeys.map(id => traces[id]);

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button danger type="primary" onClick={onDelete} disabled={!hasSelected}>
              Delete
            </Button>
            <span>
              {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
            </span>
          </div>
          <Button type="text" onClick={onRefresh} icon={<RedoOutlined />}>
            Refresh
          </Button>
          <Download filename={'traces.json'} payload={selectedTraces}>
            <Button type="text" icon={<DownloadOutlined />}>
              Download
            </Button>
          </Download>
          <div style={{ flex: 1 }}></div>
          <Button type="text"
            icon={<BarChartOutlined />}
            onClick={() => navigate('/traces-dash')}
          >
            Dashboard
          </Button>
        </div>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={data}
          loading={loading}
          onChange={handleTableChange}
          pagination={{
            current: page,
            onChange: (page) => setPage(page),
            ...tableParams.pagination,
          }}
        />
      </div>
    </>
  );
};
