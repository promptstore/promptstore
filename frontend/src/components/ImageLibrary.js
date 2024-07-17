import { useState } from 'react';
import { Button, Empty, Space, Spin } from 'antd';
import * as dayjs from 'dayjs';

export function ImageLibrary({ contentId, data, loading, onChange, onDelete, onRemix, onSave }) {

  const [selected, setSelected] = useState({});
  const [detail, setDetail] = useState(null);

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

  const handleRemix = () => {
    const selectedKey = selectedKeys[0];
    const image = data.find((im) => im.key === selectedKey);
    onRemix(image);
    setSelected({});
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

  const formatDate = (str) => {
    return dayjs(str).format('YYYY-MM-DD HH:mm:ss');
  };

  const handleCloseDetail = () => {
    setDetail(null);
  };

  const selectImage = (image) => {
    setDetail(image);
    if (typeof onChange === 'function') {
      onChange(image);
    }
  }

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
                <div className="mask-layer" onClick={() => {
                  selectImage(m);
                }}></div>
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
      {detail &&
        <div id="imagePreviewModal" className="image-preview-modal">
          <span id="previewCloseBtn" className="close-btn icon-s-closeicon-16px"
            onClick={handleCloseDetail}
          />
          <div id="imageBox" className="image-box">
            <img src={detail.imageUrl} alt="image" />
          </div>
          <div id="detailBox" className="detail-box">
            <div className="image-name" id="imagebox_name">{detail.name}</div>
            <div className="detail-list-cotnt">
              {detail.size ?
                <div className="detail-item">
                  <span className="title">Size:</span>
                  <span className="content" id="imagebox_size">{Math.round(detail.size / 1024) + 'KB'}</span>
                </div>
                : null
              }
              <div className="detail-item">
                <span className="title">Created Time:</span>
                <span className="content" id="imagebox_created">{formatDate(detail.metadata?.['Create Date'])}</span>
              </div>
              <div className="detail-item">
                <span className="title">Last Uploaded:</span>
                <span className="content" id="imagebox_uploaded">{formatDate(detail.lastUploaded)}</span>
              </div>
              {detail.approvalStatus ?
                <div className="detail-item">
                  <span className="title">Approval Status:</span>
                  <span className="content" id="imagebox_status">{detail.approvalStatus}</span>
                </div>
                : null
              }
              {detail.copyright ?
                <div className="detail-item restrict-height">
                  <span className="title">Copyright:</span>
                  <span className="content" id="imagebox_copyright">{detail.copyright}</span>
                  {detail.copyright &&
                    <span className="more">More</span>
                  }
                  <div className="clear"></div>
                </div>
                : null
              }
              {detail.termsAndConditions ?
                <div className="detail-item restrict-height">
                  <span className="title">Terms and Conditions:</span>
                  <span className="content" id="imagebox_tac">{detail.termsAndConditions}</span>
                  {detail.termsAndConditions &&
                    <span className="more">More</span>
                  }
                  <div className="clear"></div>
                </div>
                : null
              }
              {detail.additional ?
                <div className="detail-item restrict-height">
                  <span className="title">MDC Asset URL:</span>
                  <span className="content" id="imagebox_mdc_campaign_url">
                    {detail.additional?.['MDC Asset URL'] &&
                      <>
                        <span>{detail.additional?.['MDC Asset URL']}</span>
                        {/* <CopyToClipboard
                        text={detail.additional?.['MDC Asset URL']}
                        onCopy={handleCopy}
                      >
                        <button title="Copy to clipboard"
                          style={{ background: 'none', border: 'none', color: '#fff' }}
                        >
                          <i className="icon-copy" />
                        </button>
                      </CopyToClipboard> */}
                      </>
                    }
                    {!detail.additional?.['MDC Asset URL'] &&
                      <span>Not published.</span>
                    }
                  </span>
                  {/* {copied &&
                  <span style={{ color: '#177ddc' }}>Copied</span>
                } */}
                  <div className="clear"></div>
                </div>
                : null
              }
            </div>
          </div>
        </div>
      }

      <Space direction="horizontal" style={{ marginTop: 8 }}>
        <Button type="primary" size="small" style={{ fontSize: '12px' }}
          disabled={nSelected !== 1}
          onClick={handleRemix}
        >
          Remix
        </Button>
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
        <span style={{ fontSize: '12px' }}>
          {hasSelected ? `Selected ${nSelected} items` : ''}
        </span>
      </Space>
    </>
  );
}