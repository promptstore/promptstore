import { Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Button, Divider, Dropdown, Modal } from 'antd';
import { ExclamationCircleFilled, TeamOutlined } from '@ant-design/icons';

import { useAuth } from '../../contexts/AuthContext';
import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import {
  getCurrentUserAsync,
  selectCurrentUser,
} from '../../features/users/usersSlice';
import {
  selectLoaded as selectWorkspacesLoaded,
  selectWorkspaces,
} from '../../features/workspaces/workspacesSlice';
import { formatNumber, getColor } from '../../utils';

import { SearchModal } from '../SearchModal';

import './Navbar.css';

function Navbar() {

  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const { currentUser, logout, setError } = useAuth();
  const { isDarkMode, navbarState, setIsDarkMode } = useContext(NavbarContext);
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);

  const [firstName] = (currentUser.displayName || currentUser.email).split(' ');
  const avatarName = firstName.length > 4 ? firstName.slice(0, 1).toUpperCase() : firstName;

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const currentUsr = useSelector(selectCurrentUser);
  const workspaces = useSelector(selectWorkspaces);
  const workspacesLoaded = useSelector(selectWorkspacesLoaded);
  const isWorkspacesEmpty = !Object.keys(workspaces).length;

  let lastPressTime = 0;

  const handleKeyDown = (ev) => {
    if (ev.code === 'AltLeft' || ev.code === 'AltRight') {
      const thisPressTime = new Date();
      if (thisPressTime - lastPressTime <= 500) {
        lastPressTime = 0;
        openSearch();
      } else {
        lastPressTime = thisPressTime;
      }
    } else if (ev.code === 'KeyA' && ev.ctrlKey) {
      window.location.replace('/apps');
    } else if (ev.code === 'KeyC' && ev.ctrlKey) {
      window.location.replace('/compositions');
    } else if (ev.code === 'KeyD' && ev.ctrlKey) {
      window.location.replace('/design');
    } else if (ev.code === 'KeyF' && ev.ctrlKey) {
      window.location.replace('/functions');
    } else if (ev.code === 'KeyG' && ev.ctrlKey) {
      window.location.replace('/agents');
    } else if (ev.code === 'KeyH' && ev.ctrlKey) {
      window.location.replace('/home');
    } else if (ev.code === 'KeyI' && ev.ctrlKey) {
      window.location.replace('/indexes');
    } else if (ev.code === 'KeyM' && ev.ctrlKey) {
      window.location.replace('/models');
    } else if (ev.code === 'KeyP' && ev.ctrlKey) {
      window.location.replace('/prompt-sets');
    } else if (ev.code === 'KeyS' && ev.ctrlKey) {
      window.location.replace('/data-sources');
    } else if (ev.code === 'KeyT' && ev.ctrlKey) {
      window.location.replace('/traces');
    } else if (ev.code === 'KeyU' && ev.ctrlKey) {
      window.location.replace('/users');
    } else if (ev.code === 'KeyW' && ev.ctrlKey) {
      window.location.replace('/workspaces');
    }
  };

  useEffect(() => {
    dispatch(getCurrentUserAsync());
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

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
    setTimeout(() => {
      window.location.reload();
    }, 20);
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

  const onSearchCancel = () => {
    setSearchModalOpen(false);
  };

  const openSearch = () => {
    setSearchModalOpen(true);
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
    <>
      <SearchModal
        onCancel={onSearchCancel}
        open={searchModalOpen}
        indexName="pssearch"
        titleField={(r => (
          <span style={{ fontFamily: 'monospace' }}>
            <span style={{
              color: 'rgb(128, 127, 128)',
              fontSize: '11px',
              marginRight: 4,
              opacity: 0.8,
            }}>
              {r.label.toLowerCase()}
            </span>"{r.name}"
          </span>
        ))}
        indexParams={{ nodeLabel: 'Object', embeddingProvider: 'openai', vectorStoreProvider: 'redis' }}
        theme={isDarkMode ? 'dark' : 'light'}
      />
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
              <li>
                <Button type="default"
                  onClick={openSearch}
                >
                  Search
                </Button>
              </li>
              <li>
                <div style={{ color: 'rgba(0, 0, 0, 0.88)' }}>
                  Credits: {formatNumber(currentUsr?.credits) || '0'}
                </div>
              </li>
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
    </>
  );
}

export default Navbar;
