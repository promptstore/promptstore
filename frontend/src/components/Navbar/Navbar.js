import { Suspense, useContext, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Button, Divider, Dropdown, Modal } from 'antd';
import { ExclamationCircleFilled, TeamOutlined } from '@ant-design/icons';

import { useAuth } from '../../contexts/AuthContext';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import UserContext from '../../contexts/UserContext';
import {
  selectLoaded as selectWorkspacesLoaded,
  selectWorkspaces,
} from '../../features/workspaces/workspacesSlice';
import { getColor } from '../../utils';

import './Navbar.css';

function Navbar() {

  const { currentUser, logout, setError } = useAuth();
  const { isDarkMode, navbarState, setIsDarkMode } = useContext(NavbarContext);
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);
  // const { currentUser } = useContext(UserContext);

  const [firstName] = (currentUser.displayName || currentUser.email).split(' ');
  const avatarName = firstName.length > 4 ? firstName.slice(0, 1).toUpperCase() : firstName;

  const navigate = useNavigate();

  const workspaces = useSelector(selectWorkspaces);
  const workspacesLoaded = useSelector(selectWorkspacesLoaded);
  const isWorkspacesEmpty = !Object.keys(workspaces).length;

  const workspacesList = useMemo(() => {
    const list = Object.values(workspaces);
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [workspaces]);

  const handleLogout = async () => {
    try {
      setError('');
      await logout();
      navigate('/login');
    } catch {
      setError('Failed to logout');
    }
  };

  const handleSelectWorkspace = (item) => {
    const workspace = workspaces[item.key];
    setSelectedWorkspace(workspace);
  };

  const handleThemeChange = () => {
    setIsDarkMode((current) => !current);
  };

  const showLogoutConfirm = () => {
    Modal.confirm({
      title: 'Logging out',
      icon: <ExclamationCircleFilled />,
      content: 'Are you sure you want to log out?',
      onOk: handleLogout,
      okText: 'Yes',
      okType: 'primary',
      okButtonProps: { danger: true },
      cancelText: 'No',
    });
  };

  const profileMenuItems = [
    {
      key: 'profile',
      label: (
        // <Link to={process.env.REACT_APP_USER_PROFILE_URL}>View Profile</Link>
        <Link to="/profile">View Profile</Link>
      ),
    },
    {
      key: 'logout',
      label: (
        // eslint-disable-next-line
        <a href="#" onClick={showLogoutConfirm}>
          Logout
        </a>

      )
    },
    {
      key: 'theme',
      label: (
        // eslint-disable-next-line
        <a href="#" onClick={handleThemeChange}>
          {isDarkMode ? 'Light Mode' : 'Dark Mode'}
        </a>
      ),
    },
    {
      key: 'about',
      label: (
        <Link to="/about">About Prompt Store</Link>
      ),
    },
  ];

  const profileMenu = { items: profileMenuItems };

  const workspacesMenuItems = workspacesList.map(({ id, name }) => ({
    key: id,
    label: name,
  }));

  const workspacesMenu = {
    items: workspacesMenuItems,
    onClick: handleSelectWorkspace,
  };

  function MyAvatar(props) {
    if (currentUser.photoURL) {
      return (
        <Avatar
          {...props}
          alt={firstName}
          src={currentUser.photoURL}
          style={{
            cursor: 'pointer',
          }}
        />
      );
    }
    return (
      <Avatar
        {...props}
        style={{
          backgroundColor: getColor(firstName),
          cursor: 'pointer',
        }}
      >
        {avatarName}
      </Avatar>
    );
  }

  const Loading = () => (
    <div>Loading...</div>
  );

  return (
    <Suspense fallback={<Loading />}>
      <nav className="navbar">
        <div className="navbar-title" style={{ fontSize: '2em' }}>{navbarState.title}</div>
        <div className="navbar-menu" style={{ fontWeight: 600 }}>
          <ul>
            {navbarState.createLink && typeof navbarState.createLink === 'string' &&
              <li>
                <Button type="primary"
                  onClick={() => navigate(navbarState.createLink)}
                >
                  Create
                </Button>
              </li>
            }
            {navbarState.createLink && typeof navbarState.createLink === 'function' &&
              <li>
                <Button type="primary"
                  onClick={navbarState.createLink}
                >
                  Create
                </Button>
              </li>
            }
          </ul>
        </div>
        <div className="selected-entity">
          <div style={{ display: 'flex' }}>
            <div>
              <Divider type="vertical" />
            </div>
            <div>
              {workspacesLoaded ? (
                !isWorkspacesEmpty ?
                  <Dropdown menu={workspacesMenu} placement="bottomRight" arrow>
                    <div style={{ cursor: 'pointer', display: 'flex' }}>
                      <div><TeamOutlined /></div>
                      <div style={{ marginLeft: 7 }}>
                        {selectedWorkspace ?
                          <span>{selectedWorkspace.name}</span>
                          :
                          <span style={{ fontWeight: 600 }}>Select Workspace</span>
                        }
                      </div>
                    </div>
                  </Dropdown>
                  :
                  <div style={{ cursor: 'default', display: 'flex' }}>
                    <div><TeamOutlined /></div>
                    <div style={{ marginLeft: 7 }}>
                      <Link to="/workspaces/new">
                        <span style={{ fontWeight: 600 }}>Create Workspace</span>
                      </Link>
                    </div>
                  </div>
              ) : null
              }
            </div>
          </div>
        </div>
        {currentUser !== null &&
          <div>
            <Dropdown menu={profileMenu} placement="bottomRight" arrow>
              <MyAvatar />
            </Dropdown>
          </div>
        }
      </nav>
    </Suspense>
  );
}

export default Navbar;
