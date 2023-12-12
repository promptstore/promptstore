import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Divider, Modal } from 'antd';
import { DownOutlined, LinkOutlined, RightOutlined } from '@ant-design/icons';
import {
  Configure,
  Hits,
  InstantSearch,
  Pagination,
  SearchBox,
} from 'react-instantsearch';
import isFunction from 'lodash.isfunction';

import { JsonView } from './JsonView';
import WorkspaceContext from '../contexts/WorkspaceContext';
import { searchClient } from '../features/apps/Playground/contentSlice';

export function SearchModal({
  hitsPerPage = 10,
  indexName,
  onCancel,
  open,
  width = 800,
  theme = 'light',
  titleField,
  indexParams,
}) {

  const [isHitOpen, setIsHitOpen] = useState({});

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const navigate = useNavigate();

  const Hit = ({ hit }) => {

    const toggleOpen = () => {
      setIsHitOpen((cur) => ({ [hit.id]: !cur[hit.id] }));
    };

    let title;
    if (titleField) {
      if (isFunction(titleField)) {
        title = titleField(hit);
      } else {
        title = hit[titleField];
      }
    } else {
      title = hit.text;
    }

    return (
      <article className="collapsible">
        <div className="header"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 4,
          }}
          onClick={toggleOpen}
        >
          {isHitOpen[hit.id] ? <DownOutlined /> : <RightOutlined />}
          {hit.nodeLabel === 'Object' ?
            <>
              <div>{title}</div>
              <Button type="link"
                icon={<LinkOutlined />}
                onClick={(ev) => {
                  ev.stopPropagation();
                  navigate(`/${hit.type}/${hit.id.split(':')[1]}`);
                  onCancel();
                }}
              />
            </>
            :
            <div>{title}</div>
          }
        </div>
        <div className={'panel' + (isHitOpen[hit.id] ? '' : ' closed')}>
          <Divider />
          <div style={{ fontFamily: 'monospace', marginBottom: 10, whitespace: 'pre-wrap' }}>{hit.text}</div>
          <JsonView collapsed src={hit}
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
      getContainer={false}
      onCancel={onCancel}
      onOk={onCancel}
      open={open}
      title="Find"
      width={width}
      okButtonProps={{ style: { display: 'none' } }}
    >
      <InstantSearch
        searchClient={searchClient(indexParams, selectedWorkspace.id)}
        indexName={indexName}
      >
        <div className="search-panel">
          <div className="searchbox-container">
            <SearchBox
              autoFocus
              className="searchbox"
              searchAsYouType={false}
              submitIconComponent={({ classNames }) => (
                <div className={classNames.submitIcon}
                  style={{ padding: '0 8px' }}
                >Search</div>
              )}
              translations={{
                placeholder: '',
              }}
            />
            <div className="searchbox-submit">Ask</div>
          </div>
          <Configure hitsPerPage={hitsPerPage} />
          <div className="search-panel__results">
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
