import { useState, useEffect } from 'react';
import { Avatar, Button, Card, Form, Input, Modal, Space, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';

import { useAuth } from '../../contexts/AuthContext';
import { generateAvatar } from '../../utils/GenerateAvatar';
import { getColor } from '../../utils.js';

export default function Profile() {

  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [avatars, setAvatars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(-1);

  const { currentUser, updateUserProfile, setError } = useAuth();

  const [form] = Form.useForm();

  const [firstName] = (currentUser.displayName || currentUser.email).split(' ');
  const avatarName = firstName.length > 4 ? firstName.slice(0, 1).toUpperCase() : firstName;

  const fetchAvatars = () => {
    const res = generateAvatar();
    setAvatars(res);
  };

  useEffect(() => {
    fetchAvatars();
    return () => {
      setSelected(-1);
    };
  }, []);

  const handleAvatarCancel = () => {
    setAvatarModalOpen(false);
  };

  const handleNameCancel = () => {
    setNameModalOpen(false);
  };

  const handleAvatarChange = async (ev) => {
    ev.preventDefault();

    try {
      setError('');
      setLoading(true);
      const profile = { photoURL: avatars[selected] || '' };
      await updateUserProfile(currentUser, profile);
    } catch (e) {
      console.error(e);
      setError('Failed to update profile');
    }

    setLoading(false);
    setAvatarModalOpen(false);
  };

  const handleNameChange = async (ev) => {
    ev.preventDefault();

    try {
      const { displayName = '' } = await form.validateFields();
      setError('');
      setLoading(true);
      const profile = { displayName };
      await updateUserProfile(currentUser, profile);
    } catch (e) {
      console.error(e);
      setError('Failed to update profile');
    }

    setLoading(false);
    setNameModalOpen(false);
  };

  const handleSelect = (index) => (ev) => {
    ev.preventDefault();
    setSelected((current) => current === index ? -1 : index);
  };

  const setAvatar = () => {
    setAvatarModalOpen(true);
  };

  const setName = () => {
    setNameModalOpen(true);
  };

  function MyAvatar() {
    if (currentUser.photoURL) {
      return (
        <Avatar
          size="large"
          src={currentUser.photoURL}
          alt={firstName}
        />
      );
    }
    return (
      <Avatar
        size="large"
        style={{ backgroundColor: getColor(firstName) }}
      >
        {avatarName}
      </Avatar>
    );
  }

  return (
    <>
      <Modal
        onCancel={handleAvatarCancel}
        onOk={handleAvatarChange}
        okButtonProps={{ disabled: loading }}
        open={avatarModalOpen}
        title="Use Avatar"
        width={306}
      >
        <div style={{ display: 'flex', justifyContent: 'end', marginBottom: 10 }}>
          <Button type="text" icon={<SyncOutlined />} onClick={fetchAvatars} style={{ fontWeight: 600 }} />
        </div>
        <div id="avatar-gallery" className="body-section expanded" style={{ display: 'contents' }}>
          <div className="image-section" style={{ position: 'relative' }}>
            {avatars.map((avatar, i) => (
              <div key={i} className={'single-image' + (selected === i ? ' selected' : '')}>
                <img href="#" src={avatar} />
                <div className="mask-layer" onClick={handleSelect(i)}></div>
                {/* <div className="single-image-name"></div> */}
                <span
                  className={'select-box' + (selected === i ? ' icon-s-Ok2_32' : ' icon-s-UnselectedCheck_32')}
                  onClick={handleSelect(i)}
                ></span><span className="select-icon-background"></span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        onCancel={handleNameCancel}
        onOk={handleNameChange}
        okButtonProps={{ disabled: loading }}
        open={nameModalOpen}
        title="Edit Name"
        width={306}
      >
        <Form form={form}>
          <Form.Item
            name="displayName"
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <div style={{ marginTop: 20 }}>
        <Card
          style={{ width: 500 }}
        >
          <Space direction="vertical" size="large">
            <Space size="large" align="start">
              <MyAvatar />
              <div style={{ marginTop: 8 }}>
                <Typography.Paragraph strong>
                  {currentUser.displayName || currentUser.email}
                </Typography.Paragraph>
                {currentUser.displayName ?
                  <Typography.Paragraph>
                    {currentUser.email}
                  </Typography.Paragraph>
                  : null
                }
              </div>
            </Space>
            <Space>
              <Button size="small" onClick={setAvatar}>
                Change Avatar
              </Button>
              <Button size="small" onClick={setName}>
                Change Name
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    </>
  );
}
