import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import Icon, {
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  BlockOutlined,
  BookOutlined,
  CameraOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  CodepenOutlined,
  CommentOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  DoubleRightOutlined,
  EyeOutlined,
  FileOutlined,
  FileSearchOutlined,
  FlagOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FunctionOutlined,
  HomeOutlined,
  IssuesCloseOutlined,
  LockOutlined,
  MoreOutlined,
  NodeIndexOutlined,
  NotificationOutlined,
  PlaySquareOutlined,
  RadarChartOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SketchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import useLocalStorageState from 'use-local-storage-state';

import MyLogo from '../images/promptstore_logo_colour.png';
import { GrafanaLogo } from '../logos/GrafanaLogo';
import { TemporalLogo } from '../logos/TemporalLogo';

const { Sider } = Layout;

function SideMenu({ isDarkMode, isWorkspaceSelected, currentUser }) {
  const [collapsed, setCollapsed] = useLocalStorageState('ps-side-menu', { defaultValue: false });

  return (
    <Sider
      id="menu"
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      theme={isDarkMode ? 'dark' : 'light'}
      width={235}
    >
      <NavLink to="/" className={'logo-image' + (collapsed ? ' collapsed' : '')}>
        <div>
          <div>
            <img src={MyLogo} alt="Prompt Store" />
          </div>
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

const LokiIcon = props => <Icon component={GrafanaLogo} {...props} />;
const TemporalIcon = props => <Icon component={TemporalLogo} {...props} />;

const getSideMenuItems = (isWorkspaceSelected, currentUser) => {
  let sideMenuItems = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: <NavLink to="/">Home</NavLink>,
    },
    {
      key: 'workspaces',
      icon: <TeamOutlined />,
      label: <NavLink to="/workspaces">Workspaces</NavLink>,
    },
  ];

  if (isWorkspaceSelected) {
    sideMenuItems = [
      ...sideMenuItems,
      ...[
        {
          key: 'apps',
          icon: <NotificationOutlined />,
          label: <NavLink to="/apps">Apps</NavLink>,
        },
        {
          key: 'prompt-engineering',
          icon: <CodeOutlined />,
          label: 'Prompt Engineering',
          children: [
            {
              key: 'prompt-sets',
              icon: <CodeOutlined />,
              label: <NavLink to="/prompt-sets">Prompt Templates</NavLink>,
            },
            {
              key: 'prompt-designer',
              icon: <CommentOutlined />,
              label: <NavLink to="/design">Prompt Testing</NavLink>,
            },
            {
              key: 'test-scenarios',
              icon: <DoubleRightOutlined />,
              label: <NavLink to="/test-scenarios">Test Scenarios</NavLink>,
            },
            {
              key: 'imagegen',
              icon: <CameraOutlined />,
              label: <NavLink to="/imagegen">Image Generation</NavLink>,
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
              label: <NavLink to="/functions">Semantic Functions</NavLink>,
            },
            {
              key: 'composer',
              icon: <ApartmentOutlined />,
              label: <NavLink to="/compositions">Compositions</NavLink>,
            },
            {
              key: 'models',
              icon: <CodepenOutlined />,
              label: <NavLink to="/models">Models</NavLink>,
            },
            {
              key: 'agents',
              icon: <RobotOutlined />,
              label: <NavLink to="/agents">Agents</NavLink>,
            },
            {
              key: 'agent-networks',
              icon: <RadarChartOutlined />,
              label: <NavLink to="/agent-networks">Agent-Networks</NavLink>,
            },
          ],
        },
        {
          key: 'guardrails',
          icon: <CheckSquareOutlined />,
          label: 'Guardrails',
          children: [
            {
              key: 'rules',
              icon: <FlagOutlined />,
              label: <NavLink to="/rules">Rulesets</NavLink>,
            },
          ],
        },
        {
          key: 'evals',
          icon: <SafetyCertificateOutlined />,
          label: 'Evals',
          children: [
            {
              key: 'evaluations',
              icon: <SafetyCertificateOutlined />,
              label: <NavLink to="/evaluations">Evaluations</NavLink>,
            },
            {
              key: 'eval-runs',
              icon: <PlaySquareOutlined />,
              label: <NavLink to="/eval-runs">Eval Runs</NavLink>,
            },
            {
              key: 'datasets',
              icon: <DatabaseOutlined />,
              label: <NavLink to="/datasets">Human Review</NavLink>,
            },
          ],
        },
        {
          key: 'knowledge',
          icon: <DeploymentUnitOutlined />,
          label: 'Knowledge Engineering',
          children: [
            {
              key: 'documents',
              icon: <FileOutlined />,
              label: <NavLink to="/uploads">Documents</NavLink>,
            },
            {
              key: 'data-sources',
              icon: <FolderOutlined />,
              label: <NavLink to="/data-sources">Data Sources</NavLink>,
            },
            {
              key: 'destinations',
              icon: <FolderOpenOutlined />,
              label: <NavLink to="/destinations">Destinations</NavLink>,
            },
            {
              key: 'indexes',
              icon: <AppstoreOutlined />,
              label: <NavLink to="/indexes">Semantic Indexes</NavLink>,
            },
            {
              key: 'graphs',
              icon: <ShareAltOutlined />,
              label: <NavLink to="/graphs">Knowledge Graphs</NavLink>,
            },
            {
              key: 'transformations',
              icon: <SketchOutlined />,
              label: <NavLink to="/transformations">Transformations</NavLink>,
            },
            {
              key: 'ragtester',
              icon: <FileSearchOutlined />,
              label: <NavLink to="/rag">RAG Testing</NavLink>,
            },
          ],
        },
      ],
    ];
  }

  const governanceMenuItems = [
    {
      key: 'traces',
      icon: <NodeIndexOutlined />,
      style: { display: 'flex', alignItems: 'center' },
      label: <NavLink to="/traces">Traces</NavLink>,
    },
  ];
  if (currentUser?.roles?.includes('admin')) {
    governanceMenuItems.push(
      {
        key: 'background-jobs',
        icon: <TemporalIcon style={{ width: 16, marginLeft: -1, marginRight: -1 }} />,
        style: { display: 'flex', alignItems: 'center' },
        label: (
          <Link to={process.env.REACT_APP_TEMPORAL_WEB_URL} target="_blank" rel="noopener noreferrer">
            Background Jobs
          </Link>
        ),
      },
      {
        key: 'monitoring',
        icon: <LokiIcon style={{ width: 16, marginLeft: -1, marginRight: -1 }} />,
        style: { display: 'flex', alignItems: 'center' },
        label: (
          <Link to={process.env.REACT_APP_LOKI_WEB_URL} target="_blank" rel="noopener noreferrer">
            Monitoring
          </Link>
        ),
      }
    );
  }

  sideMenuItems = [
    ...sideMenuItems,
    ...[
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
              <Link to={process.env.REACT_APP_DOCUMENTATION_URL} target="_blank" rel="noopener noreferrer">
                Documentation
              </Link>
            ),
          },
          {
            key: 'api',
            icon: <ApiOutlined />,
            label: (
              <Link to="/api-docs" target="_blank" rel="noopener noreferrer">
                API
              </Link>
            ),
          },
          {
            key: 'issues',
            icon: <IssuesCloseOutlined />,
            label: (
              <Link to={process.env.REACT_APP_ISSUES_URL} target="_blank" rel="noopener noreferrer">
                Issues
              </Link>
            ),
          },
        ],
      },
    ],
  ];

  if (currentUser?.roles?.includes('admin')) {
    const settingsMenuItems = [
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: <NavLink to="/settings">Settings</NavLink>,
      },
      {
        key: 'users',
        icon: <UserOutlined />,
        label: <NavLink to="/users">User Management</NavLink>,
      },
      {
        key: 'secrets',
        icon: <LockOutlined />,
        label: <NavLink to="/secrets">Secrets</NavLink>,
      },
      {
        key: 'mirrors',
        icon: <BlockOutlined />,
        label: <NavLink to="/mirrors">Mirrors</NavLink>,
      },
      {
        key: 'admin-functions',
        icon: <MoreOutlined />,
        label: <NavLink to="/admin">Admin Functions</NavLink>,
      },
    ];

    sideMenuItems = [
      ...sideMenuItems,
      ...[
        {
          key: 'admin',
          icon: <ControlOutlined />,
          label: 'Settings',
          children: settingsMenuItems,
        },
      ],
    ];
  }

  return sideMenuItems;
};

export default SideMenu;
