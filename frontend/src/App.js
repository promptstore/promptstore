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
import Icon, {
  ApartmentOutlined,
  ApiOutlined,
  BookOutlined,
  CodeOutlined,
  CodepenOutlined,
  DeploymentUnitOutlined,
  EyeOutlined,
  FileOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FunctionOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  InteractionOutlined,
  NodeIndexOutlined,
  NotificationOutlined,
  RobotOutlined,
  SketchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';
import { ReactFlowProvider } from 'reactflow';
import isEmpty from 'lodash.isempty';

import ErrorMessage from './components/ErrorMessage';
import NavbarContext from './contexts/NavbarContext';
import WorkspaceContext from './contexts/WorkspaceContext';
import UserContext from './contexts/UserContext';
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
import { DestinationForm } from './features/destinations/DestinationForm';
import { DestinationsList } from './features/destinations/DestinationsList';
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
import { RagTester } from './features/ragtester/RagTester';
import { TraceView } from './features/traces/TraceView';
import { TracesList } from './features/traces/TracesList';
import { TrainingList } from './features/training/TrainingList';
import { TransformationForm } from './features/transformations/TransformationForm';
import { TransformationsList } from './features/transformations/TransformationsList';
import { UsersList } from './features/users/UsersList';
import OAuth2Popup from './features/Login/OAuth2Popup';
import {
  getCurrentUserAsync,
  selectCurrentUser,
  selectAuthStatusChecked,
} from './features/users/usersSlice';
import {
  getWorkspacesAsync,
  selectWorkspaces,
} from './features/workspaces/workspacesSlice';
import { onTokenExpiry, onTokenRefresh, renewToken, setToken } from './http';

import { AuthProvider } from './contexts/AuthContext';
import Register from './components/accounts/Register';
import Login from './components/accounts/Login';
import Profile from './components/accounts/Profile';
import WithPrivateRoute from './utils/WithPrivateRoute';

import MyLogo from './images/promptstore_logo_colour.png';

import './App.css';
import 'instantsearch.css/themes/satellite.css';

const Navbar = lazy(() => import('./components/Navbar'));

const LokiSvg = () => (
  <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.0478 54.9248L11.3838 50.4663L6.92529 51.1304L7.68418 55.5889L12.0478 54.9248Z" fill="url(#paint0_linear_17931_893)" />
    <path d="M46.957 42.4032L46.1981 38.0396L26.7515 41.0751L27.3206 45.4388L46.957 42.4032Z" fill="url(#paint1_linear_17931_893)" />
    <path d="M20.395 46.5772L24.8535 45.8183L24.1895 41.4546L19.731 42.1186L20.395 46.5772Z" fill="url(#paint2_linear_17931_893)" />
    <path d="M19.0674 53.7865L18.3085 49.4229L13.9448 50.0869L14.514 54.5454L19.0674 53.7865Z" fill="url(#paint3_linear_17931_893)" />
    <path d="M5.88135 44.2055L6.54539 48.6641L11.0039 48L10.3399 43.5415L5.88135 44.2055Z" fill="url(#paint4_linear_17931_893)" />
    <path d="M27.6997 47.9051L28.4586 52.4585L48.0001 49.4229L47.3361 44.9644L27.6997 47.9051Z" fill="url(#paint5_linear_17931_893)" />
    <path d="M21.5333 53.407L25.8969 52.8378L25.2329 48.2844L20.7744 49.0433L21.5333 53.407Z" fill="url(#paint6_linear_17931_893)" />
    <path d="M12.8062 43.1621L13.565 47.6205L17.9287 46.9566L17.2646 42.498L12.8062 43.1621Z" fill="url(#paint7_linear_17931_893)" />
    <path d="M7.39921 41.4546L1.99207 5.97632L0 6.26089L5.50197 41.7392L7.39921 41.4546Z" fill="url(#paint8_linear_17931_893)" />
    <path d="M9.96032 41.0751L4.07888 2.94067L2.18164 3.32014L8.06308 41.3597L9.96032 41.0751Z" fill="url(#paint9_linear_17931_893)" />
    <path d="M14.3245 40.4111L8.15847 0L6.26123 0.379412L12.4272 40.6008L14.3245 40.4111Z" fill="url(#paint10_linear_17931_893)" />
    <path d="M16.8852 40.0315L11.1935 3.2251L9.39111 3.50967L15.0828 40.2212L16.8852 40.0315Z" fill="url(#paint11_linear_17931_893)" />
    <path d="M21.2491 39.2728L16.2215 6.64038L14.3242 6.92495L19.3519 39.6523L21.2491 39.2728Z" fill="url(#paint12_linear_17931_893)" />
    <path d="M23.8104 38.8935L18.593 5.02783L16.6958 5.31241L22.0081 39.1781L23.8104 38.8935Z" fill="url(#paint13_linear_17931_893)" />
    <defs>
      <linearGradient id="paint0_linear_17931_893" x1="11.6469" y1="66.8772" x2="1.23198" y2="-0.802501" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint1_linear_17931_893" x1="39.9916" y1="62.5154" x2="29.5768" y2="-5.1639" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint2_linear_17931_893" x1="25.5063" y1="64.7445" x2="15.0913" y2="-2.93516" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint3_linear_17931_893" x1="18.5788" y1="65.8105" x2="8.1638" y2="-1.86922" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint4_linear_17931_893" x1="11.6394" y1="66.8784" x2="1.22448" y2="-0.80128" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint5_linear_17931_893" x1="39.9982" y1="62.5143" x2="29.5833" y2="-5.16528" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint6_linear_17931_893" x1="25.506" y1="64.7443" x2="15.091" y2="-2.93537" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint7_linear_17931_893" x1="18.5788" y1="65.8103" x2="8.16407" y2="-1.86867" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint8_linear_17931_893" x1="10.1623" y1="65.7597" x2="0.284696" y2="1.57166" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint9_linear_17931_893" x1="13.0129" y1="67.1431" x2="2.40785" y2="-1.77243" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint10_linear_17931_893" x1="17.6338" y1="68.0331" x2="6.38943" y2="-5.0367" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint11_linear_17931_893" x1="19.8305" y1="65.208" x2="9.57925" y2="-1.40832" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint12_linear_17931_893" x1="23.7353" y1="61.7393" x2="14.6289" y2="2.56246" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
      <linearGradient id="paint13_linear_17931_893" x1="26.4465" y1="62.1967" x2="16.9911" y2="0.751851" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FAED1E" />
        <stop offset="1" stopColor="#F15B2B" />
      </linearGradient>
    </defs>
  </svg>
);

const TemporalSvg = () => (
  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Temporal</title><path d="M16.206 7.794C15.64 3.546 14.204 0 12 0 9.796 0 8.361 3.546 7.794 7.794 3.546 8.36 0 9.796 0 12c0 2.204 3.546 3.639 7.794 4.206C8.36 20.453 9.796 24 12 24c2.204 0 3.639-3.546 4.206-7.794C20.454 15.64 24 14.204 24 12c0-2.204-3.547-3.64-7.794-4.206Zm-8.55 7.174c-4.069-.587-6.44-1.932-6.44-2.969 0-1.036 2.372-2.381 6.44-2.969-.09.98-.137 1.98-.137 2.97 0 .99.047 1.99.137 2.968zM12 1.215c1.036 0 2.381 2.372 2.969 6.44a32.718 32.718 0 0 0-5.938 0c.587-4.068 1.932-6.44 2.969-6.44Zm4.344 13.753c-.2.03-1.022.126-1.23.146-.02.209-.117 1.03-.145 1.23-.588 4.068-1.933 6.44-2.97 6.44-1.036 0-2.38-2.372-2.968-6.44-.03-.2-.126-1.022-.147-1.23a31.833 31.833 0 0 1 0-6.23 31.813 31.813 0 0 1 7.46.146c4.068.587 6.442 1.933 6.442 2.969-.001 1.036-2.374 2.382-6.442 2.97z" /></svg>
);

const LokiIcon = (props) => (<Icon component={LokiSvg} {...props} />);
const TemporalIcon = (props) => (<Icon component={TemporalSvg} {...props} />);

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

const getSideMenuItems = (isWorkspaceSelected, currentUser) => {
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
        children: [
          {
            key: 'prompt-sets',
            icon: <CodeOutlined />,
            label: (
              <NavLink to="/prompt-sets">Prompt Templates</NavLink>
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
              <NavLink to="/compositions">Compositions</NavLink>
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
        children: [
          {
            key: 'documents',
            icon: <FileOutlined />,
            label: (
              <NavLink to="/uploads">Documents</NavLink>
            ),
          },
          {
            key: 'data-sources',
            icon: <FolderOutlined />,
            label: (
              <NavLink to="/data-sources">Data Sources</NavLink>
            ),
          },
          {
            key: 'destinations',
            icon: <FolderOpenOutlined />,
            label: (
              <NavLink to="/destinations">Destinations</NavLink>
            ),
          },
          {
            key: 'transformations',
            icon: <SketchOutlined />,
            label: (
              <NavLink to="/transformations">Transformations</NavLink>
            ),
          },
          {
            key: 'indexes',
            icon: <InfoCircleOutlined />,
            label: (
              <NavLink to="/indexes">Semantic Indexes</NavLink>
            ),
          },
          {
            key: 'ragtester',
            icon: <FileSearchOutlined />,
            label: (
              <NavLink to="/rag">RAG Tester</NavLink>
            ),
          },
        ],
      },
    ]];
  }

  const governanceMenuItems = [
    {
      key: 'traces',
      icon: <NodeIndexOutlined />,
      style: { display: 'flex', alignItems: 'center' },
      label: (
        <NavLink to="/traces">Traces</NavLink>
      ),
    },
  ];
  if (currentUser?.roles?.includes('admin')) {
    governanceMenuItems.push(
      {
        key: 'background-jobs',
        icon: <TemporalIcon style={{ width: 16, marginLeft: -1, marginRight: -1 }} />,
        style: { display: 'flex', alignItems: 'center' },
        label: (
          <Link to={process.env.REACT_APP_TEMPORAL_WEB_URL} target="_blank" rel="noopener noreferrer">Background Jobs</Link>
        ),
      },
      {
        key: 'monitoring',
        icon: <LokiIcon style={{ width: 16, marginLeft: -1, marginRight: -1 }} />,
        style: { display: 'flex', alignItems: 'center' },
        label: (
          <Link to={process.env.REACT_APP_LOKI_WEB_URL} target="_blank" rel="noopener noreferrer">Monitoring</Link>
        ),
      },
    );
  }

  sideMenuItems = [...sideMenuItems, ...[
    {
      key: 'debugging',
      icon: <EyeOutlined />,
      label: 'Observability',
      children: governanceMenuItems,
    },
    {
      key: 'support',
      icon: <BookOutlined />,
      label: 'Support',
      children: [
        {
          key: 'documentation',
          icon: <BookOutlined />,
          label: (
            <Link to={process.env.REACT_APP_DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">Documentation</Link>
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

function SideMenu({ isDarkMode, isWorkspaceSelected, currentUser }) {

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
        items={getSideMenuItems(isWorkspaceSelected, currentUser)}
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
  const [ready, setReady] = useState(0);

  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorageState('workspace', null);

  const navbarContextValue = { isDarkMode, navbarState, setNavbarState, setIsDarkMode };
  const workspaceContextValue = { selectedWorkspace, setSelectedWorkspace };
  const userContextValue = { currentUser, setCurrentUser };

  const authStatusChecked = useSelector(selectAuthStatusChecked);
  const currentUsr = useSelector(selectCurrentUser);
  const workspaces = useSelector(selectWorkspaces);

  const dispatch = useDispatch();


  /* keycloak sso - TODO ***********/

  // useEffect(() => {
  //   dispatch(getCurrentUserAsync());

  //   onTokenExpiry(() => {
  //     window.location.replace('/login');
  //   });

  //   onTokenRefresh((token) => {
  //     setCurrentUser((current) => ({
  //       ...current,
  //       ...token,
  //     }));
  //   });

  //   // renew token every 20 min
  //   const interval = setInterval(renewToken, 1200000);
  //   return () => clearInterval(interval);
  // }, []);

  // useEffect(() => {
  //   if (!ready && currentUsr) {
  //     const { accessToken, refreshToken } = currentUsr;
  //     setToken({ accessToken, refreshToken });
  //     setCurrentUser((current) => ({ ...(current || {}), ...currentUsr }));
  //     setReady(true);
  //   }
  // }, [currentUsr]);

  /* ***********/

  useEffect(() => {
    if (authStatusChecked && !currentUsr) {
      setReady(2);
    }
  }, [authStatusChecked]);

  useEffect(() => {
    if (process.env.REACT_APP_FIREBASE_API_KEY) {
      console.log('using firebase');
      let unsubscribe;
      import('./config/firebase.js')
        .then(({ default: auth }) => {
          // console.log('auth:', auth);
          // Adds an observer for changes to the signed-in user's ID token, 
          // which includes sign-in, sign-out, and token refresh events. This 
          // method has the same behavior as `firebase.auth.Auth.onAuthStateChanged` 
          // had prior to 4.0.0.
          // `onAuthStateChanged` - Prior to 4.0.0, this triggered the observer 
          // when users were signed in, signed out, or when the user's ID token 
          // changed in situations such as token expiry or password change. After 
          // 4.0.0, the observer is only triggered on sign-in or sign-out.
          // current version - ^10.1.0
          unsubscribe = auth.onIdTokenChanged(async (user) => {
            // console.log('user:', user);
            if (user) {
              const accessToken = await user.getIdToken();
              // console.log('accessToken:', accessToken);
              if (accessToken) {
                setToken({ accessToken });
                setCurrentUser((cur) => {
                  if (cur) {
                    return { ...cur, ...user };
                  }
                  return user;
                });
              }
            }
          });
        });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };

    } else if (process.env.REACT_APP_PROMPTSTORE_API_KEY) {
      console.log('using service account ');
      setToken({ accessToken: process.env.REACT_APP_PROMPTSTORE_API_KEY });
      const defaultUser = {
        email: 'test.account@promptstore.dev',
        roles: ['admin'],
        fullName: 'Test Account',
        firstName: 'Test',
        lastName: 'Account',
        photoURL: 'https://avatars.dicebear.com/api/gridy/0.5334164767352256.svg',
        username: 'test.account@promptstore.dev',
        displayName: 'Test Account',
      };
      setCurrentUser(defaultUser);
      dispatch(getWorkspacesAsync());
      setReady(1);
    }
  }, []);

  useEffect(() => {
    // console.log('currentUser:', currentUser, ready);
    if (ready === 0 && currentUser) {
      // console.log('currentUsr:', currentUsr);
      if (!currentUsr) {
        dispatch(getCurrentUserAsync());
      } else {
        setCurrentUser((current) => current ? { ...current, ...currentUsr } : currentUsr);
        dispatch(getWorkspacesAsync());
        setReady(1);
      }
    }
  }, [currentUser, currentUsr, ready]);

  useEffect(() => {
    if (ready === 1) {
      if (selectedWorkspace && !isEmpty(workspaces)) {
        if (!Object.values(workspaces).find(w => w.id === selectedWorkspace.id)) {
          setSelectedWorkspace(null);
        }
      }
      setReady(2);
    }
  }, [ready, selectedWorkspace, workspaces]);

  const router = createBrowserRouter(
    createRoutesFromElements(
      <>
        <Route path="/callback" element={<OAuth2Popup />} />
        <Route exact path="/register" element={<Register />} />
        <Route exact path="/login" element={<Login />} />
        <Route path="*" element={
          <WithPrivateRoute>
            <Layout style={{ minHeight: '100vh' }} className={isDarkMode ? 'dark' : 'light'}>
              <SideMenu
                isDarkMode={isDarkMode}
                isWorkspaceSelected={!!selectedWorkspace}
                currentUser={currentUser}
              />
              <Layout className="site-layout">
                <MyHeader isDarkMode={isDarkMode} />
                <Content style={{ margin: '0 16px' }}>
                  <Routes>
                    <Route exact path="/profile" element={<Profile />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/apps-edit/:id" element={<AppForm />} />
                    <Route path="/apps/:id" element={<AppView />} />
                    <Route path="/apps" element={<AppsList />} />
                    <Route path="/compositions/:id" element={<Composer />} />
                    <Route path="/compositions" element={<CompositionsList />} />
                    <Route path="/data-sources/:id" element={<DataSourceForm />} />
                    <Route path="/data-sources" element={<DataSourcesList />} />
                    <Route path="/design/:id" element={<Designer />} />
                    <Route path="/design" element={<Designer />} />
                    <Route path="/destinations/:id" element={<DestinationForm />} />
                    <Route path="/destinations" element={<DestinationsList />} />
                    <Route path="/functions/:id" element={<FunctionForm />} />
                    <Route path="/functions" element={<FunctionsList />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/indexes/:id" element={<IndexForm />} />
                    <Route path="/indexes" element={<IndexesList />} />
                    <Route path="/models/:id" element={<ModelForm />} />
                    <Route path="/models" element={<ModelsList />} />
                    {/* <Route path="/profile" element={<ProfileView />} /> */}
                    <Route path="/prompt-sets/:id" element={<PromptSetForm />} />
                    <Route path="/prompt-sets" element={<PromptSetsList />} />
                    <Route path="/rag" element={<RagTester />} />
                    <Route path="/traces/:id" element={<TraceView />} />
                    <Route path="/traces" element={<TracesList />} />
                    <Route path="/training" element={<TrainingList />} />
                    <Route path="/transformations/:id" element={<TransformationForm />} />
                    <Route path="/transformations" element={<TransformationsList />} />
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
          </WithPrivateRoute>
        } />
      </>
    )
  );

  const Loading = () => (
    <div style={{ margin: '20px 40px' }}>Loading...</div>
  );

  // if (ready < 2 && !authStatusChecked) {
  //   return (
  //     <div style={{ margin: '20px 40px' }}>Authenticating...</div>
  //   );
  // }
  // if (ready < 2) {
  //   return (
  //     <Loading />
  //   );
  // }
  return (
    <Suspense fallback={<Loading />}>
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        }}
      >
        <AuthProvider>
          <UserContext.Provider value={userContextValue}>
            <WorkspaceContext.Provider value={workspaceContextValue}>
              <NavbarContext.Provider value={navbarContextValue}>
                <ReactFlowProvider>
                  <ErrorMessage />
                  <RouterProvider router={router} />
                </ReactFlowProvider>
              </NavbarContext.Provider>
            </WorkspaceContext.Provider>
          </UserContext.Provider>
        </AuthProvider>
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
