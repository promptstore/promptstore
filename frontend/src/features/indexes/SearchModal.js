import { useState } from 'react';
import { Divider, Modal } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import {
  Configure,
  Hits,
  InstantSearch,
  Pagination,
  SearchBox,
} from 'react-instantsearch-dom';

import { JsonView } from '../../components/JsonView';
import { searchClient } from '../apps/Playground/contentSlice';

export function SearchModal({
  hitsPerPage = 8,
  indexName,
  onCancel,
  open,
  width = 800,
  theme = 'light',
  titleField,
  indexParams,
}) {

  const [isHitOpen, setIsHitOpen] = useState({});

  const Hit = ({ hit }) => {

    const toggleOpen = () => {
      setIsHitOpen((cur) => ({ [hit.id]: !cur[hit.id] }));
    };

    return (
      <article className="collapsible">
        <div className="header" onClick={toggleOpen}>
          {isHitOpen[hit.id] ? <DownOutlined /> : <RightOutlined />}
          <span>{hit[titleField]}</span>
        </div>
        <div className={'panel' + (isHitOpen[hit.id] ? '' : ' closed')}>
          <Divider />
          <JsonView src={hit}
            theme={theme === 'dark' ? 'grayscale' : 'grayscale:inverted'}
          />
        </div>
      </article>
    );
  };

  if (!open || !indexName) {
    return (
      <></>
    );
  }
  return (
    <Modal
      onCancel={onCancel}
      onOk={onCancel}
      open={open}
      title="Search"
      width={width}
    >
      <InstantSearch searchClient={searchClient(indexParams)} indexName={indexName}>
        <Configure hitsPerPage={hitsPerPage} />
        <div className="search-panel">
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
