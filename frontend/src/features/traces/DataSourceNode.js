import { memo, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Modal, Table } from 'antd';
import { Handle, Position } from 'reactflow';

import {
  getChunksAsync,
  selectChunks,
  selectLoading,
} from '../indexes/chunksSlice';

export default memo(({ id, data, isConnectable }) => {

  console.log('data:', data);

  const [isModalOpen, setModalOpen] = useState(false);

  const chunks = useSelector(selectChunks);
  const loading = useSelector(selectLoading);

  // console.log('chunks:', chunks);

  const dispatch = useDispatch();

  const onCancel = () => {
    setModalOpen(false);
  };

  const viewHits = (vectorStoreProvider, indexName, hits) => {
    const ids = hits.map(h => h.id);
    dispatch(getChunksAsync({ ids, indexName, vectorStoreProvider }));
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Items',
      dataIndex: 'text',
    },
    {
      title: 'Reference',
      dataIndex: 'reference',
    },
    {
      title: 'Score',
      dataIndex: 'score',
    }
  ];

  const numberFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

  const hitData = useMemo(() => {
    if (Object.keys(chunks).length && data.hits?.length) {
      // console.log('chunks:', chunks);
      // console.log('hits:', data.hits);
      return data.hits
        .map(h => {
          const chunk = chunks[h.id];
          if (!chunk) return null;
          const { filename, objectName, endpoint, database } = chunk.metadata;
          const reference = filename || objectName || endpoint || database;
          return {
            key: chunk.id,
            text: chunk.text,
            reference,
            score: numberFormatter.format(h.rerankerScore || h.score),
          };
        })
        .filter(c => c);
    }
    return [];
  }, [chunks, data]);

  return (
    <>
      <Modal
        cancelText="Close"
        okButtonProps={{ style: { display: 'none' } }}
        onCancel={onCancel}
        open={isModalOpen}
        title="Context"
        width={'75%'}
      >
        <Table
          columns={columns}
          dataSource={hitData}
          loading={loading}
          pagination={false}
        />
        <div className="text-secondary" style={{ marginTop: 10 }}>
          {data.hits[0].isDistanceMetric ?
            <div style={{ display: 'inline-block', marginRight: 8 }}>
              Score is a distance metric, therefore smaller is better.
            </div>
            : null
          }
          {data.hits[0].rerankerScore ?
            <div style={{ display: 'inline-block', marginRight: 8 }}>
              Results have used a reranker model, scores are the reranked relevance scores.
            </div>
            : null
          }

        </div>
      </Modal>
      <div className="custom-node__header">
        <div style={{ display: 'flex' }}>
          {data.label}
          <div style={{ flex: 1 }}></div>
          {data.hits?.length ?
            <Link onClick={() => viewHits(data.vectorStoreProvider, data.indexName, data.hits)}>Hits</Link>
            : null
          }
        </div>
      </div>
      <div className="custom-node__body">
        <Link to={`/data-sources/${data.dataSourceId}`}>{data.dataSourceName}</Link>
      </div>
      <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
      <Handle type="source" position={Position.Right} id="a" isConnectable={isConnectable} />
    </>
  );
});
