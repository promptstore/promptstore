import { useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Button, Space, Table, Typography, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { CopyToClipboard } from 'react-copy-to-clipboard';

import NavbarContext from '../../context/NavbarContext';
import UserContext from '../../context/UserContext';
import {
  updateContentsAsync,
} from '../apps/Playground/contentSlice';
import {
  getContentsForReviewAsync,
  selectLoaded,
  selectReviews,
  setReviews,
} from './reviewsSlice';
import {
  getUsersAsync,
  selectUsers,
} from '../users/usersSlice';

const { Text } = Typography;

export function ReviewsList() {

  const [copied, setCopied] = useState({});

  const loaded = useSelector(selectLoaded);
  const reviews = useSelector(selectReviews);
  const users = useSelector(selectUsers);

  const data = useMemo(() => {
    const list = Object.values(reviews).map((review) => {
      const user = Object.values(users).find((u) => u.username === review.modifiedBy);
      return {
        key: review.id,
        text: review.text,
        status: review.status,
        modifiedBy: user?.fullName,
      };
    });
    return list;
  }, [reviews, users]);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);

  const dispatch = useDispatch();

  const location = useLocation();

  const [messageApi, contextHolder] = message.useMessage();

  // console.log('reviews:', reviews);
  // console.log('currentUser:', currentUser);
  // console.log('users:', users);

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      title: 'My Reviews',
    }));
    dispatch(getUsersAsync());
  }, []);

  useEffect(() => {
    if (currentUser) {
      dispatch(getContentsForReviewAsync({ userId: currentUser.username }));
    }
  }, [currentUser]);

  useEffect(() => {
    if (location.state && location.state.message) {
      messageApi.info({
        content: location.state.message,
        duration: 3,
      });
    }
  }, [location]);

  const onApprove = (key) => {
    const content = reviews[key];
    const newContent = { ...content, status: 'Approved' };
    dispatch(setReviews({ contents: [newContent] }));
    dispatch(updateContentsAsync({ values: [newContent] }));
  };

  const onReject = (key) => {
    const content = reviews[key];
    const newContent = { ...content, status: 'Rejected' };
    dispatch(setReviews({ contents: [newContent] }));
    dispatch(updateContentsAsync({ values: [newContent] }));
  };

  const onCopy = (key) => {
    setCopied((state) => ({ ...state, [key]: true }));
    setTimeout(() => {
      setCopied((state) => ({ ...state, [key]: false }));
    }, 3000);
  };

  const columns = [
    {
      title: 'Copy',
      dataIndex: 'text',
      width: '100%',
      render: (_, { key, text, status }) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            {status === 'Approved' ?
              <CheckOutlined style={{ fontSize: '1.5em', marginRight: 10 }} />
              : null
            }
            <Text style={{ textDecoration: status === 'Rejected' ? 'line-through' : 'none' }}>
              {text}
              {copied[key] &&
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
              text={text}
              onCopy={() => onCopy(key)}
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
      )
    },
    {
      title: 'Submitter',
      dataIndex: 'modifiedBy',
      render: (_, { modifiedBy }) => (
        <div style={{ whiteSpace: 'nowrap' }}>{modifiedBy}</div>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => onApprove(record.key)}
          >
            Approve
          </Button>
          <Button type="link"
            style={{ paddingLeft: 0 }}
            onClick={() => onReject(record.key)}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div style={{ marginTop: 20 }}>
        <Table columns={columns} dataSource={data} />
      </div>
    </>
  );
};
