import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, List, Progress, Space, Statistic, Typography } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import NavbarContext from '../../contexts/NavbarContext';
import UserContext from '../../contexts/UserContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getAppsAsync,
  selectLoading as selectAppsLoading,
  selectApps,
} from '../apps/appsSlice';
import {
  getContentsByFilterAsync,
  getContentsAsync,
  selectContents,
  selectLoading as selectContentsLoading,
} from '../apps/Playground/contentSlice';
import {
  getWorkspacesAsync,
  selectLoading as selectWorkspacesLoading,
  selectWorkspaces,
} from '../workspaces/workspacesSlice';

import {
  getStatisticsAsync,
  selectLoading as selectStatisticsLoading,
  selectStatistics,
} from './statisticsSlice';

const { Text, Title } = Typography;

export function Home() {

  const [copied, setCopied] = useState({});

  const apps = useSelector(selectApps);
  const appsLoading = useSelector(selectAppsLoading);
  const contents = useSelector(selectContents);
  const contentsLoading = useSelector(selectContentsLoading);
  const statistics = useSelector(selectStatistics);
  const statisticsLoading = useSelector(selectStatisticsLoading);
  const workspaces = useSelector(selectWorkspaces);
  const workspacesLoading = useSelector(selectWorkspacesLoading);

  // console.log('statistics:', statistics);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const appsData = useMemo(() => {
    const list = Object.values(apps)
      .map((p) => ({ title: p.name, key: p.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [apps]);

  const contentsData = useMemo(() => {
    const list = Object.values(contents).slice(0, 5)
      .map((p) => ({ title: p.text, key: p.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [contents]);

  const workspacesData = useMemo(() => {
    const list = Object.values(workspaces)
      .map((p) => ({ title: p.name, key: p.id }));
    list.sort((a, b) => a.title < b.title ? -1 : 1);
    return list;
  }, [workspaces]);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: null,
    }));
  }, []);

  // useEffect(() => {
  //   if (currentUser) {
  //     // dispatch(getContentsForReviewAsync({ userId: currentUser.username }));
  //     // dispatch(getContentsByFilterAsync({
  //     //   // status: 'deployed',
  //     //   username: currentUser.username,
  //     // }));
  //   }
  // }, [currentUser]);

  useEffect(() => {
    if (selectedWorkspace) {
      const workspaceId = selectedWorkspace.id;
      dispatch(getAppsAsync({ workspaceId }));
      dispatch(getStatisticsAsync({ workspaceId }));
    }
  }, [selectedWorkspace]);

  const onCopy = (key) => {
    setCopied((state) => ({ ...state, [key]: true }));
    setTimeout(() => {
      setCopied((state) => ({ ...state, [key]: false }));
    }, 3000);
  };

  const percents = [15.3, 14.9, 11.2, 7.6, 3.5];

  const getPercent = (i) => {
    return percents[i];
  };

  return (
    <div style={{ marginTop: 40 }}>
      <Title level={2}>
        Prompt Store
      </Title>
      <div style={{ marginTop: 40 }}>
        <Space direction="vertical" size="large">
          <Space align="start" size="large" wrap={true}>
            {Object.entries(statistics).map(([key, stat]) =>
              <Card bordered={false} key={key}>
                <Statistic
                  formatter={(value) => <Link to={`/${key}`}>{value}</Link>}
                  loading={statisticsLoading}
                  style={{ width: 170 }}
                  title={stat.title}
                  value={stat.value}
                />
              </Card>
            )}
          </Space>
          <Space align="start" size="large" wrap={true}>
            <Card loading={workspacesLoading} title="My Workspaces" style={{ minHeight: 271, width: 350 }}>
              <List
                dataSource={workspacesData}
                renderItem={(item) => (
                  <List.Item key={item.key}>
                    <Link to={`/workspaces/${item.key}`}>{item.title}</Link>
                  </List.Item>
                )}
              />
            </Card>
            <Card loading={appsLoading} title="My Apps" style={{ minHeight: 271, width: 350 }}>
              <List
                dataSource={appsData}
                renderItem={(item) => (
                  <List.Item key={item.key}>
                    <Link to={`/apps/${item.key}`}>{item.title}</Link>
                  </List.Item>
                )}
              />
            </Card>
            <Card loading={contentsLoading} title="Recent Activity" style={{ minHeight: 271, width: 600 }}>
              <List
                dataSource={contentsData}
                renderItem={(item, i) => (
                  <List.Item key={item.key}>
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <div style={{ alignItems: 'center', display: 'flex', width: '100%' }}>
                        <div style={{ flex: 1, width: '100%' }}>
                          <Text style={{ fontSize: '1em', fontStyle: 'italic' }}>
                            {item.title}
                            {copied[item.key] &&
                              <span
                                style={{ color: '#888', fontSize: '0.85em', marginLeft: 8 }}
                              >
                                Copied!
                              </span>
                            }
                          </Text>
                        </div>
                        <div style={{ marginLeft: 8, width: 12 }}>
                          <CopyToClipboard
                            text={item.title}
                            onCopy={() => onCopy(item.key)}
                          >
                            <button
                              style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.85em' }}
                              title="Copy to clipboard"
                            >
                              <i className="icon-copy" />
                            </button>
                          </CopyToClipboard>
                        </div>
                      </div>
                      <Progress
                        percent={getPercent(i)}
                        style={{ fontSize: '0.85em', marginTop: 8, width: '100%' }}
                      />
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Space>
      </div>
    </div>
  );
}
