import { useState } from 'react';
import { Button, Empty, Space } from 'antd';

export function ImageLibrary({ data, onDelete, onSave }) {

  const [selected, setSelected] = useState({});

  const hasSelected = Object.values(selected).some(x => x);
  const nSelected = Object.values(selected).filter(x => x).length;
  const selectedKeys = Object.entries(selected).filter(([_, v]) => v).map(([k, _]) => k);

  const handleSelect = (key) => (ev) => {
    ev.stopPropagation();
    setSelected((current) => ({
      ...current,
      [key]: !current[key]
    }));
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Space direction="horizontal">
          <Button type="primary"
            disabled={!hasSelected}
            onClick={() => onSave(selectedKeys)}
          >
            Save
          </Button>
          <Button danger type="primary"
            disabled={!hasSelected}
            onClick={() => onDelete(selectedKeys)}
          >
            Delete
          </Button>
          <span style={{ marginLeft: 8 }}>
            {hasSelected ? `Selected ${nSelected} items` : ''}
          </span>
        </Space>
      </div>
      {data.length ?
        <div id="cantoImageBody" className="body-section expanded" style={{ height: 'auto' }}>
          <div id="imagesContent" className="image-section">
            {data.map((m) => {
              return (
                <div
                  className={'single-image' + (selected[m.key] ? ' selected' : '')} key={m.key}
                  data-id={m.key}
                >
                  <img id={m.key} src={m.imageUrl} />
                  <div className="mask-layer"></div>
                  <div className="single-image-name">{m.status}</div>
                  <span
                    className={'select-box' + (selected[m.key] ? ' icon-s-Ok2_32' : ' icon-s-UnselectedCheck_32')}
                    onClick={handleSelect(m.key)}
                  ></span><span className="select-icon-background"></span>
                </div>
              );
            })}
          </div>
        </div>
        :
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      }
    </>
  );
}