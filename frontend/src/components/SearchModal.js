import { useContext, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Button, Divider, Modal, Typography } from 'antd';
import { DownOutlined, LinkOutlined, RightOutlined } from '@ant-design/icons';
import {
  Configure,
  Hits,
  InstantSearch,
  Pagination,
  useInstantSearch,
  useSearchBox,
} from 'react-instantsearch';
import isFunction from 'lodash.isfunction';

import WorkspaceContext from '../contexts/WorkspaceContext';
import { searchClient } from '../features/apps/Playground/contentSlice';
import {
  getFunctionResponseAsync,
  selectMessages,
  setMessages,
} from '../features/designer/chatSlice';
import { JsonView } from './JsonView';

function CustomSearchBox(props) {

  const { query, refine } = useSearchBox(props);
  const { status } = useInstantSearch();

  const [inputValue, setInputValue] = useState(query);

  const { selectedWorkspace } = useContext(WorkspaceContext);

  const inputRef = useRef(null);

  const dispatch = useDispatch();

  const isSearchStalled = status === 'stalled';

  const ask = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    dispatch(setMessages({ messages: [] }));
    dispatch(getFunctionResponseAsync({
      functionName: 'answer_app_question',
      args: { content: inputValue },
      history: [],
      params: { maxTokens: 512 },
      workspaceId: selectedWorkspace.id,
    }));
  };

  function setQuery(newQuery) {
    setInputValue(newQuery);
  }

  return (
    <div className="ais-SearchBox searchbox">
      <form className="ais-SearchBox-form"
        action=""
        role="search"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (inputRef.current) {
            inputRef.current.blur();
          }
          refine(inputValue);
          dispatch(setMessages({ messages: [] }));
        }}
        onReset={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setQuery('');
          if (inputRef.current) {
            inputRef.current.focus();
          }
          refine('');
          dispatch(setMessages({ messages: [] }));
        }}
      >
        <input className="ais-SearchBox-input"
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={512}
          type="search"
          value={inputValue}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
          autoFocus
        />
        <button type="submit"
          className="ais-SearchBox-submit"
          style={{ padding: '0 8px' }}
        >
          Search
        </button>
        <button
          className="ais-SearchBox-submit"
          style={{ padding: '0 8px' }}
          onClick={ask}
        >
          Ask
        </button>
        <button
          type="reset"
          className="ais-SearchBox-reset"
          hidden={inputValue.length === 0 || isSearchStalled}
          title="Clear the search query"
        >
          <svg className="ais-SearchBox-resetIcon" viewBox="0 0 20 20" width="10" height="10" aria-hidden="true"><path d="M8.114 10L.944 2.83 0 1.885 1.886 0l.943.943L10 8.113l7.17-7.17.944-.943L20 1.886l-.943.943-7.17 7.17 7.17 7.17.943.944L18.114 20l-.943-.943-7.17-7.17-7.17 7.17-.944.943L0 18.114l.943-.943L8.113 10z"></path></svg>
        </button>
        <span class="ais-SearchBox-loadingIndicator" hidden={!isSearchStalled}>
          <svg aria-label="Results are loading" width="16" height="16" viewBox="0 0 38 38" stroke="#444" class="ais-SearchBox-loadingIcon" aria-hidden="true"><g fill="none" fill-rule="evenodd"><g transform="translate(1 1)" stroke-width="2"><circle stroke-opacity=".5" cx="18" cy="18" r="18"></circle><path d="M36 18c0-9.94-8.06-18-18-18"><animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"></animateTransform></path></g></g></svg>
        </span>
      </form>
    </div>
  );
}

export function SearchModal({
  container,
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

  const messages = useSelector(selectMessages);

  // console.log('messages:', messages);
  const response = messages[messages.length - 1]?.content[0]?.content;

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
          <div style={{ fontFamily: 'monospace', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{hit.text}</div>
          <JsonView collapsed src={hit} theme={theme === 'dark' ? 'grayscale' : 'grayscale:inverted'} />
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
      getContainer={container || false}
      onCancel={onCancel}
      onOk={onCancel}
      open={open}
      title="Search"
      width={width}
      okButtonProps={{ style: { display: 'none' } }}
      cancelText="Close"
    >
      <InstantSearch
        searchClient={searchClient(indexParams, selectedWorkspace.id)}
        indexName={indexName}
      >
        <div className="search-panel">
          <div className="searchbox-container">
            <CustomSearchBox />
          </div>
          <Configure hitsPerPage={hitsPerPage} />
          <div className="search-panel__results">
            {response ?
              <div style={{ padding: '20px 40px' }}>
                <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap' }}>
                  {response}
                </Typography.Paragraph>
              </div>
              :
              <>
                <Hits hitComponent={Hit} />
                {/* <div className="pagination">
                  <Pagination />
                </div> */}
              </>
            }
          </div>
        </div>
      </InstantSearch>
    </Modal>
  );
}
