import { useState } from 'react';
import { Button, Empty, Space, Spin } from 'antd';

export function ImageLibrary({ contentId, data, loading, onDelete, onSave }) {

  const [selected, setSelected] = useState({});

  const hasSelected = Object.values(selected).some(x => x);
  const nSelected = Object.values(selected).filter(x => x).length;
  const selectedKeys = Object.entries(selected).filter(([_, v]) => v).map(([k, _]) => k);

  const handleDelete = () => {
    onDelete(selectedKeys);
    setSelected({});
  };

  const handleSave = () => {
    onSave(selectedKeys);
    setSelected({});
  };

  const handleSelect = (key) => (ev) => {
    ev.stopPropagation();
    setSelected((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  const Spinner = () => (
    <div className="single-image">
      <div style={{ alignItems: 'center', display: 'flex', height: '100%', justifyContent: 'center' }}>
        <Spin />
      </div>
    </div>
  );

  const NoData = () => {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
    )
  };

  return (
    <>
      {(loading || data.length > 0) ?
        <div id="cantoImageBody" className="body-section expanded"
          style={{ display: 'contents' }}
        >
          <div id="imagesContent" className="image-section" style={{ position: 'relative' }}>
            {data.filter((m) => contentId ? m.contentId === contentId : true).map((m) => (
              <div
                className={'single-image' + (selected[m.key] ? ' selected' : '')} key={m.key}
                data-id={m.key}
              >
                <img id={m.key} src={m.imageUrl} alt="" />
                <div className="mask-layer"></div>
                <div className="single-image-name">{m.status}</div>
                <span
                  className={'select-box' + (selected[m.key] ? ' icon-s-Ok2_32' : ' icon-s-UnselectedCheck_32')}
                  onClick={handleSelect(m.key)}
                ></span><span className="select-icon-background"></span>
              </div>
            ))}
            {loading ?
              <Spinner />
              : null
            }
          </div>
        </div>
        :
        <NoData />
      }
      <Space direction="horizontal" style={{ marginTop: 8 }}>
        <Button type="primary" size="small" style={{ fontSize: '12px' }}
          disabled={!hasSelected}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button danger type="primary" size="small" style={{ fontSize: '12px' }}
          disabled={!hasSelected}
          onClick={handleDelete}
        >
          Delete Images
        </Button>
        <span style={{ fontSize: '12px', marginLeft: 8 }}>
          {hasSelected ? `Selected ${nSelected} items` : ''}
        </span>
      </Space>
    </>
  );
}