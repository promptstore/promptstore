import { Suspense, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Avatar, Button, Divider, Dropdown } from 'antd';
import { TeamOutlined } from '@ant-design/icons';

import NavbarContext from '../../context/NavbarContext';
import WorkspaceContext from '../../context/WorkspaceContext';
import UserContext from '../../context/UserContext';
import {
  getWorkspacesAsync,
  selectLoaded as selectWorkspacesLoaded,
  selectWorkspaces,
} from '../../features/workspaces/workspacesSlice';
import { getColor } from '../../utils';

import './Navbar.css';

function Navbar() {

  const { isDarkMode, navbarState, setIsDarkMode } = useContext(NavbarContext);
  const { selectedWorkspace, setSelectedWorkspace } = useContext(WorkspaceContext);
  const { currentUser } = useContext(UserContext);

  const dispatch = useDispatch();

  const workspaces = useSelector(selectWorkspaces);
  const workspacesLoaded = useSelector(selectWorkspacesLoaded);
  const isWorkspacesEmpty = Object.keys(workspaces).length === 0;

  const workspacesList = useMemo(() => {
    const list = Object.values(workspaces);
    list.sort((a, b) => a.name > b.name ? 1 : -1);
    return list;
  }, [workspaces]);

  useEffect(() => {
    dispatch(getWorkspacesAsync());
  }, []);

  const handleWorkspacesMenuClick = (item) => {
    const workspace = workspaces[item.key];
    setSelectedWorkspace(workspace);
  };

  const handleThemeChange = () => {
    setIsDarkMode((current) => !current);
  };

  const profileMenuItems = [
    {
      key: 'profile',
      label: (
        <Link to={process.env.REACT_APP_USER_PROFILE_URL}>View Profile</Link>
      ),
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
    onClick: handleWorkspacesMenuClick,
  };

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
                <Link to={navbarState.createLink}>Create</Link>
              </li>
            }
            {navbarState.createLink && typeof navbarState.createLink === 'function' &&
              <li>
                <Button type="link"
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
                          <span style={{ fontWeight: 600 }}>{'Select Workspace'}</span>
                        }
                      </div>
                    </div>
                  </Dropdown>
                  :
                  <div style={{ cursor: 'default', display: 'flex' }}>
                    <div><TeamOutlined /></div>
                    <div style={{ marginLeft: 7 }}>
                      <Link to="/workspaces/new">
                        <span style={{ fontWeight: 600 }}>{'Create Workspace'}</span>
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
              <Avatar
                style={{
                  backgroundColor: getColor(currentUser.firstName),
                  cursor: 'pointer',
                }}
              >
                {currentUser.firstName}
              </Avatar>
            </Dropdown>
          </div>
        }
      </nav>
    </Suspense>
  );
}

export default Navbar;
