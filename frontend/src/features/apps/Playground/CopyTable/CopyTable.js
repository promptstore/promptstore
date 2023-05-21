import { useState } from 'react';
import { Button, Rate, Space, Table } from 'antd';
import { RedoOutlined, UndoOutlined } from '@ant-design/icons';
import { CSVLink } from 'react-csv';
import * as dayjs from 'dayjs';

import { ImageLibrary } from '../../../../components/ImageLibrary';
import { formatCurrency, slugify } from '../../../../utils';

import { ActionsColumn } from './ActionsColumn';
import { CopyColumn } from './CopyColumn';
import { StatusColumn } from './StatusColumn';

export function CopyTable({
  data,
  editRow,
  editableRowValues,
  generateCopyImage,
  imagesData,
  imagesLoading,
  increaseLength,
  like,
  loaded,
  loading,
  name,
  onChangeRowCopy,
  onDelete,
  onDeleteImages,
  onExpand,
  onRatingChange,
  onSave,
  onSaveImages,
  onRedo,
  onUndo,
  reduceLength,
  refine,
  showVersionsModal,
  submitForReview,
  tourRefs,
  userData,
  undoDisabled,
  redoDisabled,
}) {

  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const handleDelete = () => {
    onDelete(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const handleExpand = (expanded, record) => {
    if (expanded) {
      onExpand(expanded, record);
      setExpandedRowKeys((current) => [...current, record.key]);
    } else {
      setExpandedRowKeys((current) => {
        const arr = [...current];
        const idx = arr.indexOf(record.key);
        arr.splice(idx, 1);
        return arr;
      });
    }
  };

  const handleGenerateCopyImage = (key) => {
    generateCopyImage(key);
    setExpandedRowKeys((current) => [...current, key]);
  };

  const onSelectChange = (newSelectedRowKeys) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const handleSave = () => {
    onSave(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const getFilename = () => {
    const dt = dayjs().format('YYYYMMDD-HHmm');
    return `${slugify(name)}-content-${dt}.csv`;
  };

  const cleanData = (data) => {
    return data
      .map((d) => ({
        key: d.key,
        content: d.text,
        approval_status: d.approvalStatus,
        likes: d.likes,
        token_count: d.usage?.total_tokens,
        cost: d.usage ? d.usage.total_tokens / 1000 * 0.002 : '',
      }))
      .map((d) => Object.entries(d)
        .reduce((a, [k, v]) => {
          let val;
          if (typeof v === 'string') {
            val = v.replace(/"/g, '""');
          } else {
            val = v;
          }
          a[k] = val;
          return a;
        }, {}))
      ;
  };

  const hasSelected = selectedRowKeys.length > 0;

  const columns = [
    {
      title: 'Copy',
      dataIndex: 'text',
      width: '100%',
      render: (_, { key, likes, text }) => (
        <CopyColumn recordKey={key}
          editValue={editableRowValues[key]}
          like={like}
          likes={likes}
          onChangeRowCopy={onChangeRowCopy}
          text={text}
        />
      ),
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      render: (_, { key, rating }) => (
        <div style={{ whiteSpace: 'nowrap', width: 132 }}>
          <Rate
            allowClear
            onChange={(value) => { onRatingChange(key, value); }}
            value={rating}
          />
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (_, { approvalStatus, saveStatus }) => (
        <StatusColumn
          approvalStatus={approvalStatus}
          saveStatus={saveStatus}
        />
      ),
    },
    // {
    //   title: 'Cost',
    //   dataIndex: 'cost',
    //   className: 'col-hdr-nowrap',
    //   align: 'right',
    //   render: (_, { usage }) => (
    //     <span>{usage ? formatCurrency(usage.total_tokens / 1000 * 0.002) : ''}</span>
    //   ),
    // },
    {
      title: 'Actions',
      key: 'action',
      render: (_, record) => {
        if (record.isImage) {
          return null;
        }
        return (
          <ActionsColumn
            editRow={editRow}
            generateCopyImage={handleGenerateCopyImage}
            increaseLength={increaseLength}
            record={record}
            reduceLength={reduceLength}
            refine={refine}
            showVersionsModal={showVersionsModal}
            submitForReview={submitForReview}
            userData={userData}
          />
        );
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
    ],
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Space direction="horizontal">
          <Button ref={tourRefs.save} type="primary"
            disabled={!hasSelected}
            onClick={handleSave}
          >
            Save
          </Button>
          <Button danger type="primary"
            disabled={!hasSelected}
            onClick={handleDelete}
          >
            Delete
          </Button>
          <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
            {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
          </span>
        </Space>
        <div style={{ flex: 1 }}></div>
        <Space direction="horizontal">
          <Button type="text"
            disabled={undoDisabled}
            // icon={<UndoOutlined />}
            onClick={onUndo}
          >
            Undo
          </Button>
          <Button type="text"
            disabled={redoDisabled}
            // icon={<RedoOutlined />}
            onClick={onRedo}
          >
            Redo
          </Button>
          <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>
            {hasSelected ? `Selected ${selectedRowKeys.length} items` : ''}
          </span>
        </Space>
        <div style={{ margin: '0 16px' }}>
          {loaded ?
            <CSVLink
              data={cleanData(data)}
              filename={getFilename()}
            >
              Download
            </CSVLink>
            : null
          }
        </div>
      </div>
      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={data}
        loading={loading}
        expandable={{
          expandedRowRender: ({ key }) => (
            <ImageLibrary
              contentId={key}
              data={imagesData}
              loading={imagesLoading}
              onDelete={onDeleteImages}
              onSave={onSaveImages}
            />
          ),
          onExpand: handleExpand,
          rowExpandable: (record) => true,
          expandedRowKeys,
        }}
      />
    </>
  );
}