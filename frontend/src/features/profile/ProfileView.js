import { useContext, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Avatar, Card } from 'antd';

import NavbarContext from '../../context/NavbarContext';
import UserContext from '../../context/UserContext';
import { getColor } from '../../utils';
import {
  getUserAsync,
  selectLoaded,
  selectUsers,
} from '../users/usersSlice';

const { Meta } = Card;

export function ProfileView() {

  const loaded = useSelector(selectLoaded);
  const users = useSelector(selectUsers);

  const { setNavbarState } = useContext(NavbarContext);
  const { currentUser } = useContext(UserContext);

  const location = useLocation();
  const dispatch = useDispatch();

  const match = location.pathname.match(/\/profile\/(.*)/);
  const id = match && match[1];
  const user = users[id];

  useEffect(() => {
    setNavbarState((state) => ({
      ...state,
      createLink: null,
      title: 'User Profile',
    }));
    if (id) {
      dispatch(getUserAsync(id));
    }
  }, []);

  const u = user || currentUser;

  if (id && !loaded) {
    return (
      <div style={{ marginTop: 40 }}>
        Loading...
      </div>
    )
  }
  if (!u) {
    return (
      <div style={{ marginTop: 40 }}>
        Not logged in
      </div>
    );
  }
  return (
    <div id="profile-view" style={{ marginTop: 40 }}>
      <Card
        style={{
          width: 400,
        }}
      >
        <Meta
          avatar={
            <Avatar
              style={{ backgroundColor: getColor(u.firstName) }}
            >
              {u.firstName}
            </Avatar>
          }
          title={u.fullName}
          description={u.email}
          style={{ color: 'rgba(0, 0, 0, 0.88)' }}
        />
      </Card>
    </div>
  );
}
