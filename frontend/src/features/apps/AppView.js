import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { Card, List, Space } from 'antd';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getAppAsync,
  selectLoaded,
  selectApps,
} from '../apps/appsSlice';
import {
  getDataSourcesAsync,
  selectLoading as selectDataSourcesLoading,
  selectDataSources,
} from '../dataSources/dataSourcesSlice';
import {
  getFunctionsAsync,
  selectLoading as selectFunctionsLoading,
  selectFunctions,
} from '../functions/functionsSlice';
import {
  getIndexesAsync,
  selectLoading as selectIndexesLoading,
  selectIndexes,
} from '../indexes/indexesSlice';
import {
  getPromptSetsAsync,
  selectLoading as selectPromptSetsLoading,
  selectPromptSets,
} from '../promptSets/promptSetsSlice';

export function AppView() {

  const apps = useSelector(selectApps);
  const loaded = useSelector(selectLoaded);
  const dataSources = useSelector(selectDataSources);
  const dataSourcesLoading = useSelector(selectDataSourcesLoading);
  const functions = useSelector(selectFunctions);
  const functionsLoading = useSelector(selectFunctionsLoading);
  const indexes = useSelector(selectIndexes);
  const indexesLoading = useSelector(selectIndexesLoading);
  const promptSets = useSelector(selectPromptSets);
  const promptSetsLoading = useSelector(selectPromptSetsLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();

  const id = location.pathname.match(/\/apps\/(.*)/)[1];
  const app = apps[id];

  const promptSetsData = useMemo(() => {
    if (!app) return [];
    const list = Object.values(promptSets)
      .filter((p) => app.promptSets?.includes(p.id))
      .map((p) => ({ title: p.name, key: p.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [app, promptSets]);

  const functionsData = useMemo(() => {
    if (!app) return [];
    const list = Object.values(functions)
      .filter((f) => app.functions?.includes(f.id))
      .map((f) => ({ title: f.name, key: f.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [app, functions]);

  const dataSourcesData = useMemo(() => {
    if (!app) return [];
    const list = Object.values(dataSources)
      .filter((f) => app.dataSources?.includes(f.id))
      .map((f) => ({ title: f.name, key: f.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [app, dataSources]);

  const indexesData = useMemo(() => {
    if (!app) return [];
    const list = Object.values(indexes)
      .filter((f) => app.indexes?.includes(f.id))
      .map((f) => ({ title: f.name, key: f.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [app, indexes]);

  useEffect(() => {
    dispatch(getAppAsync(id));
  }, []);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: app?.name || 'App',
    }));
  }, [app]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getIndexesAsync({ workspaceId }));
      dispatch(getDataSourcesAsync({ workspaceId }));
      dispatch(getFunctionsAsync({ workspaceId }));
      dispatch(getPromptSetsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  return (
    <div style={{ marginTop: 40 }}>
      <Space align="start" size="large" wrap={true}>
        <Card loading={promptSetsLoading} title="Prompts" style={{ minHeight: 271, width: 350 }}>
          <List
            dataSource={promptSetsData}
            renderItem={(item) => (
              <List.Item key={item.key}>
                <Link to={`/prompt-sets/${item.key}`}>{item.title}</Link>
              </List.Item>
            )}
          />
        </Card>
        <Card loading={functionsLoading} title="Semantic Functions" style={{ minHeight: 271, width: 360 }}>
          <List
            dataSource={functionsData}
            renderItem={(item, i) => (
              <List.Item key={item.key}>
                <Link to={`/functions/${item.key}`}>{item.title}</Link>
              </List.Item>
            )}
          />
        </Card>
        <Card loading={dataSourcesLoading} title="Data Sources" style={{ minHeight: 271, width: 360 }}>
          <List
            dataSource={dataSourcesData}
            renderItem={(item, i) => (
              <List.Item key={item.key}>
                <Link to={`/data-sources/${item.key}`}>{item.title}</Link>
              </List.Item>
            )}
          />
        </Card>
        <Card loading={indexesLoading} title="Indexes" style={{ minHeight: 271, width: 360 }}>
          <List
            dataSource={indexesData}
            renderItem={(item, i) => (
              <List.Item key={item.key}>
                <Link to={`/indexes/${item.key}`}>{item.title}</Link>
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </div>
  );
}
