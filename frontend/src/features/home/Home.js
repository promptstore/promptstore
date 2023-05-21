import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, List, Progress, Space, Typography } from 'antd';
import { AlertOutlined } from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import NavbarContext from '../../context/NavbarContext';
import UserContext from '../../context/UserContext';
import {
  getContentsByFilterAsync,
  getContentsAsync,
  selectContents,
} from '../apps/Playground/contentSlice';
import {
  getWorkspacesAsync,
  selectWorkspaces,
} from '../workspaces/workspacesSlice';
import {
  getContentsForReviewAsync,
  selectReviews,
} from '../reviews/reviewsSlice';

const { Text, Title } = Typography;

export function Home() {

  const [copied, setCopied] = useState({});

  const workspaces = useSelector(selectWorkspaces);
  const contents = useSelector(selectContents);
  const reviews = useSelector(selectReviews);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const workspacesData = Object.values(workspaces).map((p) => ({ title: p.name, key: p.id }));
  const contentsData = Object.values(contents).slice(0, 5).map((p) => ({ title: p.text, key: p.id }));

  const hasReviews = Object.values(reviews).filter((r) => !r.status).length;

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: null,
    }));
  }, []);

  useEffect(() => {
    if (currentUser) {
      // dispatch(getContentsForReviewAsync({ userId: currentUser.username }));
      // dispatch(getContentsByFilterAsync({
      //   // status: 'deployed',
      //   username: currentUser.username,
      // }));
    }
  }, [currentUser]);

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
          {hasReviews > 0 ? (
            <Button type="link"
              icon={<AlertOutlined style={{ fontSize: '2em' }} />}
              onClick={() => navigate('/reviews')}
            >
              {`You have ${hasReviews} review${hasReviews > 1 ? 's' : ''} waiting`}
            </Button>
          )
            : null
          }
          <Space align="start" size="large">
            <Card title="My Workspaces" style={{ width: 350 }}>
              <List
                dataSource={workspacesData}
                renderItem={(item) => (
                  <List.Item key={item.key}>
                    <Link to={`/workspaces/${item.key}`}>{item.title}</Link>
                  </List.Item>
                )}
              />
            </Card>
            <Card title="Recent Activity" style={{ width: 600 }}>
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
