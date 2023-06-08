import { useState } from 'react';
import { Divider, Modal } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import {
  InstantSearch,
  Configure,
  Hits,
  SearchBox,
  Panel,
  RefinementList,
  Pagination,
  Highlight,
} from 'react-instantsearch-dom';
import ReactJson from 'react-json-view';

import { searchClient } from '../apps/Playground/contentSlice';

export function SearchModal({
  hitsPerPage = 8,
  indexName,
  onCancel,
  open,
  width = 800,
  theme = 'light',
}) {

  const [isHitOpen, setIsHitOpen] = useState({});

  const Hit = ({ hit }) => {

    const toggleOpen = () => {
      setIsHitOpen((cur) => ({ [hit.__uid]: !cur[hit.__uid] }));
    };

    return (
      <article className="collapsible">
        <div className="header" onClick={toggleOpen}>
          {isHitOpen[hit.__uid] ? <DownOutlined /> : <RightOutlined />}
          <span>{hit.text}</span>
        </div>
        <div className={'panel' + (isHitOpen[hit.__uid] ? '' : ' closed')}>
          <Divider />
          <ReactJson src={hit}
            theme={theme === 'dark' ? 'shapeshifter' : 'rjv-default'}
          />
        </div>
      </article>
    );
  };

  return (
    <Modal
      onCancel={onCancel}
      onOk={onCancel}
      open={open}
      title="Search"
      width={width}
    >
      <InstantSearch searchClient={searchClient} indexName={indexName}>
        <Configure hitsPerPage={hitsPerPage} />
        <div className="search-panel">
          {/* <div className="search-panel__filters">
            <Panel header="session">
              <RefinementList attribute="sessionid" />
            </Panel>
          </div> */}
          <div className="search-panel__results">
            <SearchBox
              className="searchbox"
              translations={{
                placeholder: '',
              }}
            />
            <Hits hitComponent={Hit} />
            <div className="pagination">
              <Pagination />
            </div>
          </div>
        </div>
      </InstantSearch>
    </Modal>
  );
}
