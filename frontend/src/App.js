import { Suspense, lazy, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Link,
  NavLink,
  RouterProvider,
  Routes,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import { ConfigProvider, theme, Layout, Menu } from 'antd';
import {
  ApartmentOutlined,
  ApiOutlined,
  BookOutlined,
  BorderlessTableOutlined,
  CodeOutlined,
  CodepenOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileOutlined,
  FunctionOutlined,
  HomeOutlined,
  InteractionOutlined,
  NotificationOutlined,
  RobotOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';
import { ReactFlowProvider } from 'reactflow';

import NavbarContext from './context/NavbarContext';
import WorkspaceContext from './context/WorkspaceContext';
import UserContext from './context/UserContext';
import { About } from './features/about/About';
import { Agents } from './features/agents/Agents';
import { AppForm } from './features/apps/AppForm';
import { AppView } from './features/apps/AppView';
import { AppsList } from './features/apps/AppsList';
import { Composer } from './features/composer/Composer';
import { CompositionsList } from './features/composer/CompositionsList';
import { DataSourceForm } from './features/dataSources/DataSourceForm';
import { DataSourcesList } from './features/dataSources/DataSourcesList';
import { Designer } from './features/designer/Designer';
import { FileUploader } from './features/uploader/FileUploader';
import { FunctionForm } from './features/functions/FunctionForm';
import { FunctionsList } from './features/functions/FunctionsList';
import { Home } from './features/home/Home';
import { IndexForm } from './features/indexes/IndexForm';
import { IndexesList } from './features/indexes/IndexesList';
import { ModelForm } from './features/models/ModelForm';
import { ModelsList } from './features/models/ModelsList';
import { ProfileView } from './features/profile/ProfileView';
import { WorkspaceForm } from './features/workspaces/WorkspaceForm';
import { WorkspacesList } from './features/workspaces/WorkspacesList';
import { PromptSetsList } from './features/promptSets/PromptSetsList';
import { PromptSetForm } from './features/promptSets/PromptSetForm';
import { TrainingList } from './features/training/TrainingList';
import { UsersList } from './features/users/UsersList';
import OAuth2Popup from './features/Login/OAuth2Popup';
import {
  getCurrentUserAsync,
  selectCurrentUser,
  selectAuthStatusChecked,
} from './features/users/usersSlice';
import { onTokenExpiry, onTokenRefresh, renewToken, setToken } from './http';

import MyLogo from './images/promptstore_logo_colour.png';

import './App.css';
import 'instantsearch.css/themes/satellite.css';

const Navbar = lazy(() => import('./components/Navbar'));

const { Header, Content, Footer, Sider } = Layout;
const { defaultAlgorithm, darkAlgorithm } = theme;

function MyHeader({ isDarkMode }) {
  return (
    <Header className="site-layout-background"
      style={{
        background: isDarkMode ? '#001529' : '#fff',
        padding: '0 16px',
      }}
    >
      <Navbar />
    </Header>
  );
}

const getSideMenuItems = (isWorkspaceSelected) => {
  let sideMenuItems = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: (
        <NavLink to="/">Home</NavLink>
      ),
    },
    {
      key: 'workspaces',
      icon: <TeamOutlined />,
      label: (
        <NavLink to="/workspaces">Workspaces</NavLink>
      ),
    },
  ];

  if (isWorkspaceSelected) {
    sideMenuItems = [...sideMenuItems, ...[
      {
        key: 'apps',
        icon: <NotificationOutlined />,
        label: (
          <NavLink to="/apps">Apps</NavLink>
        ),
      },
      {
        key: 'agents',
        icon: <RobotOutlined />,
        label: (
          <NavLink to="/agents">Agents</NavLink>
        ),
      },
      // {
      //   key: 'training',
      //   icon: <DatabaseOutlined />,
      //   label: (
      //     <NavLink to="/training">Training Set</NavLink>
      //   ),
      // },
      {
        key: 'prompt-engineering',
        icon: <CodeOutlined />,
        label: 'Prompt Engineering',
        // label: (
        //   <NavLink to="/prompt-sets">Prompt Engineering</NavLink>
        // ),
        children: [
          {
            key: 'prompt-sets',
            icon: <CodeOutlined />,
            label: (
              <NavLink to="/prompt-sets">Prompts</NavLink>
            ),
          },
          {
            key: 'prompt-designer',
            icon: <InteractionOutlined />,
            label: (
              <NavLink to="/design">Prompt Design</NavLink>
            ),
          },
        ],
      },
      {
        key: 'model-execution',
        icon: <FunctionOutlined />,
        label: 'Model Execution',
        // label: (
        //   <NavLink to="/functions">Model Execution</NavLink>
        // ),
        children: [
          {
            key: 'functions',
            icon: <FunctionOutlined />,
            label: (
              <NavLink to="/functions">Semantic Functions</NavLink>
            ),
          },
          {
            key: 'composer',
            icon: <ApartmentOutlined />,
            label: (
              <NavLink to="/compositions">Composer</NavLink>
            ),
          },
          {
            key: 'models',
            icon: <CodepenOutlined />,
            label: (
              <NavLink to="/models">Models</NavLink>
            ),
          },
        ],
      },
      {
        key: 'knowledge',
        icon: <DeploymentUnitOutlined />,
        label: 'Knowledge',
        // label: (
        //   <NavLink to="/data-sources">Knowledge</NavLink>
        // ),
        children: [
          {
            key: 'data-sources',
            icon: <DatabaseOutlined />,
            label: (
              <NavLink to="/data-sources">Data Sources</NavLink>
            ),
          },
          {
            key: 'documents',
            icon: <FileOutlined />,
            label: (
              <NavLink to="/uploads">Documents</NavLink>
            ),
          },
          {
            key: 'indexes',
            icon: <BorderlessTableOutlined />,
            label: (
              <NavLink to="/indexes">Indexes</NavLink>
            ),
          },
        ],
      },
    ]];
  }

  sideMenuItems = [...sideMenuItems, ...[
    {
      key: 'support',
      icon: <BookOutlined />,
      label: 'Support',
      // label: (
      //   <Link to="https://promptstoredocs.devsheds.io/" target="_blank" rel="noopener noreferrer">Documentation</Link>
      // ),
      children: [
        {
          key: 'documentation',
          icon: <BookOutlined />,
          label: (
            <Link to="https://promptstoredocs.devsheds.io/" target="_blank" rel="noopener noreferrer">Documentation</Link>
          ),
        },
        {
          key: 'api',
          icon: <ApiOutlined />,
          label: (
            <Link to="/api-docs" target="_blank" rel="noopener noreferrer">API</Link>
          ),
        },
      ],
    },
  ]];

  return sideMenuItems;
};

function SideMenu({ isDarkMode, isWorkspaceSelected }) {

  const [collapsed, setCollapsed] = useState(false);

  return (
    <Sider id="menu" collapsible collapsed={collapsed} onCollapse={setCollapsed} theme={isDarkMode ? 'dark' : 'light'}>
      <NavLink to="/" className={'logo-image' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div><img src={MyLogo} alt="Prompt Store" /></div>
          <div>Prompt Store</div>
        </div>
      </NavLink>
      <br />
      <Menu
        items={getSideMenuItems(isWorkspaceSelected)}
        mode="vertical"
        theme={isDarkMode ? 'dark' : 'light'}
        triggerSubMenuAction="click"
      />
    </Sider>
  );
}

function App() {

  const [currentUser, setCurrentUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useLocalStorageState('darkMode', true);
  const [navbarState, setNavbarState] = useState({});
  const [ready, setReady] = useState(false);

  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorageState('workspace', null);

  const navbarContextValue = { isDarkMode, navbarState, setNavbarState, setIsDarkMode };
  const workspaceContextValue = { selectedWorkspace, setSelectedWorkspace };
  const userContextValue = { currentUser, setCurrentUser };

  const authStatusChecked = useSelector(selectAuthStatusChecked);
  const currentUsr = useSelector(selectCurrentUser);

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getCurrentUserAsync());

    onTokenExpiry(() => {
      window.location.replace('/login');
    });

    onTokenRefresh((token) => {
      setCurrentUser((current) => ({
        ...current,
        ...token,
      }));
    });

    // renew token every 20 min
    const interval = setInterval(renewToken, 1200000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ready && currentUsr) {
      const { accessToken, refreshToken } = currentUsr;
      setToken({ accessToken, refreshToken });
      setCurrentUser(currentUsr);

      setReady(true);
    }
  }, [currentUsr]);

  useEffect(() => {
    if (authStatusChecked && !currentUsr) {
      window.location.replace('/login');
    }
  }, [authStatusChecked]);

  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/callback" element={<OAuth2Popup />} />
        <Route path="*" element={
          <Layout style={{ minHeight: '100vh' }} className={isDarkMode ? 'dark' : 'light'}>
            <SideMenu isDarkMode={isDarkMode} isWorkspaceSelected={!!selectedWorkspace} />
            <Layout className="site-layout">
              <MyHeader isDarkMode={isDarkMode} />
              <Content style={{ margin: '0 16px' }}>
                <Routes>
                  <Route path="/about" element={<About />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/apps-edit/:id" element={<AppForm />} />
                  <Route path="/apps/:id" element={<AppView />} />
                  <Route path="/apps" element={<AppsList />} />
                  <Route path="/compositions/:id" element={<Composer />} />
                  <Route path="/compositions" element={<CompositionsList />} />
                  <Route path="/data-sources/:id" element={<DataSourceForm />} />
                  <Route path="/data-sources" element={<DataSourcesList />} />
                  <Route path="/design" element={<Designer />} />
                  <Route path="/functions/:id" element={<FunctionForm />} />
                  <Route path="/functions" element={<FunctionsList />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/indexes/:id" element={<IndexForm />} />
                  <Route path="/indexes" element={<IndexesList />} />
                  <Route path="/models/:id" element={<ModelForm />} />
                  <Route path="/models" element={<ModelsList />} />
                  <Route path="/profile" element={<ProfileView />} />
                  <Route path="/prompt-sets/:id" element={<PromptSetForm />} />
                  <Route path="/prompt-sets" element={<PromptSetsList />} />
                  <Route path="/training" element={<TrainingList />} />
                  <Route path="/uploads" element={<FileUploader />} />
                  <Route path="/users" element={<UsersList />} />
                  <Route path="/workspaces/:id" element={<WorkspaceForm />} />
                  <Route path="/workspaces" element={<WorkspacesList />} />
                  <Route path="/" element={<Home />} />
                </Routes>
              </Content>
              <Footer style={{ textAlign: 'center' }}>Prompt Store ©2023</Footer>
            </Layout>
          </Layout>
        } />
      </>
    )
  );

  const Loading = () => (
    <div style={{ margin: '20px 40px' }}>Loading...</div>
  );

  if (!ready && !authStatusChecked) {
    return (
      <div style={{ margin: '20px 40px' }}>Authenticating...</div>
    );
  }
  if (!currentUsr) {
    return (
      <div style={{ margin: '20px 40px' }}>Unauthorized</div>
    );
  }
  return (
    <Suspense fallback={<Loading />}>
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        }}
      >
        <UserContext.Provider value={userContextValue}>
          <WorkspaceContext.Provider value={workspaceContextValue}>
            <NavbarContext.Provider value={navbarContextValue}>
              <ReactFlowProvider>
                <RouterProvider router={router} />
              </ReactFlowProvider>
            </NavbarContext.Provider>
          </WorkspaceContext.Provider>
        </UserContext.Provider>
      </ConfigProvider>
    </Suspense>
  );
}

// function PrivateRoute({ children, rules, ...rest }) {

//   const blockingRule = rules.find(r => !r.condition);

//   return (
//     <Route {...rest}
//       render={({ location }) =>
//         !blockingRule ?
//           children
//           :
//           <Redirect to={{
//             pathname: blockingRule.redirect,
//             state: {
//               from: location,
//               message: blockingRule.message,
//             }
//           }} />
//       }
//     />
//   );
// }

export default App;
