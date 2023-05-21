import { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Hits, InstantSearch, SearchBox } from 'react-instantsearch-hooks-web';
import { Button, Checkbox } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';

import { searchClient, setContents } from './contentSlice';

export function MySearchBox({ appId, data, workspaceId, tourRefs }) {

  const [selectedHits, setSelectedHits] = useState({});

  const dispatch = useDispatch();

  const insertContents = () => {
    const values = Object.values(selectedHits).map((h) => h.value);
    const inserts =
      values
        .filter((text) => {
          return data.some((x) => x.text !== text);
        })
        .map((text) => ({
          appId,
          contentId: uuidv4(),
          isNew: true,
          text: text.trim(),
        }))
      ;
    dispatch(setContents({ contents: inserts }));
  };

  const Hit = useCallback(({ hit }) => {

    const handleChange = () => {
      setSelectedHits((state) => ({
        ...state,
        [hit.uid]: state[hit.uid] || hit,
      }));
    };

    return (
      <div style={{ display: 'flex' }} key={hit.uid}>
        <div style={{ alignItems: 'center', display: 'flex', marginRight: 10 }}>
          <Checkbox onChange={handleChange} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '1em' }}>{hit.value}</div>
        </div>
      </div>
    );
  }, []);

  return (
    <div>
      <div ref={tourRefs.search} style={{ width: 482 }}>
        <InstantSearch
          searchClient={searchClient}
          indexName={'workspace-' + workspaceId}
        >
          <SearchBox style={{ display: 'inline-block', width: 450 }} />
          <Hits hitComponent={Hit} style={{ width: 450 }} />
        </InstantSearch>
        <Button type="text"
          icon={<PlusOutlined />}
          onClick={insertContents}
        />
      </div>
    </div>
  );
}