import { lazy } from 'react';
import {
  Routes,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from 'react-router-dom';
import { Layout } from 'antd';

import SideMenu from './components/SideMenu';
import Register from './components/accounts/Register';
import Login from './components/accounts/Login';
import Profile from './components/accounts/Profile';
import OAuth2Popup from './features/Login/OAuth2Popup';
import { About } from './features/about/About';
import { AdminFunctions } from './features/adminFunctions/AdminFunctions';
import { AgentNetwork } from './features/agentNetworks/AgentNetwork';
import { AgentNetworksList } from './features/agentNetworks/AgentNetworksList';
import { Agents } from './features/agents/Agents';
import { Analyst } from './features/apps/Analyst';
import { AppChat } from './features/apps/AppChat';
import { AppForm } from './features/apps/AppForm';
import { AppFormNew } from './features/apps/AppFormNew';
import { AppView } from './features/apps/AppView';
import { AppsList } from './features/apps/AppsList';
import { Composer } from './features/composer/Composer';
import { CompositionsList } from './features/composer/CompositionsList';
import { DataSourceForm } from './features/dataSources/DataSourceForm';
import { DataSourcesList } from './features/dataSources/DataSourcesList';
import { Designer } from './features/designer/Designer';
import { DestinationForm } from './features/destinations/DestinationForm';
import { DestinationsList } from './features/destinations/DestinationsList';
import { EvaluationForm } from './features/evaluations/EvaluationForm';
import { EvaluationsList } from './features/evaluations/EvaluationsList';
import { EvaluationRuns } from './features/evaluations/EvaluationRuns';
import { EvalRuns } from './features/evaluations/EvalRuns';
import { FileUploader } from './features/uploader/FileUploader';
import { FunctionForm } from './features/functions/FunctionForm';
import { FunctionView } from './features/functions/FunctionView';
import { FunctionsList } from './features/functions/FunctionsList';
import { Home } from './features/home/Home';
import { ImageGen } from './features/imagegen/ImageGen';
import { IndexForm } from './features/indexes/IndexForm';
import { IndexesList } from './features/indexes/IndexesList';
import { MirrorsList } from './features/mirrors/MirrorsList';
import { MirrorForm } from './features/mirrors/MirrorForm';
import { ModelForm } from './features/models/ModelForm';
import { ModelView } from './features/models/ModelView';
import { ModelsList } from './features/models/ModelsList';
import { ProfileView } from './features/profile/ProfileView';
import { WorkspaceForm } from './features/workspaces/WorkspaceForm';
import { WorkspacesList } from './features/workspaces/WorkspacesList';
import { PromptSetsList } from './features/promptSets/PromptSetsList';
import { PromptSetForm } from './features/promptSets/PromptSetForm';
import { PromptSetView } from './features/promptSets/PromptSetView';
import { RagTester } from './features/ragtester/RagTester';
import { RulesList } from './features/rules/RulesList';
import { RuleForm } from './features/rules/RuleForm';
import { Secrets } from './features/secrets/Secrets';
import { SettingsList } from './features/settings/SettingsList';
import { SettingsForm } from './features/settings/SettingsForm';
import { TracesDashboard } from './features/traces/TracesDashboard';
import { TraceView } from './features/traces/TraceView';
import { TracesList } from './features/traces/TracesList';
import { TrainingList } from './features/training/TrainingList';
import { TransformationForm } from './features/transformations/TransformationForm';
import { TransformationsList } from './features/transformations/TransformationsList';
import { UserForm } from './features/users/UserForm';
import { UsersList } from './features/users/UsersList';
import WithPrivateRoute from './utils/WithPrivateRoute';

const Navbar = lazy(() => import('./components/Navbar'));

const { Header, Content, Footer } = Layout;

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

const router = ({ currentUser, isDarkMode, selectedWorkspace }) => {
  return createBrowserRouter(
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
                    <Route path="/agent-networks/:id" element={<AgentNetwork />} />
                    <Route path="/agent-networks" element={<AgentNetworksList />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/admin" element={<AdminFunctions />} />
                    <Route path="/apps-edit/:id" element={<AppFormNew />} />
                    <Route path="/apps/:id" element={<AppChat />} />
                    {/* <Route path="/apps/:id" element={<AppView />} /> */}
                    <Route path="/apps/:id/analyst" element={<Analyst />} />
                    <Route path="/apps" element={<AppsList />} />
                    <Route path="/compositions/:id" element={<Composer />} />
                    <Route path="/compositions" element={<CompositionsList />} />
                    <Route path="/data-sources/:id" element={<DataSourceForm />} />
                    <Route path="/data-sources" element={<DataSourcesList />} />
                    <Route path="/design/:id" element={<Designer />} />
                    <Route path="/design" element={<Designer />} />
                    <Route path="/destinations/:id" element={<DestinationForm />} />
                    <Route path="/destinations" element={<DestinationsList />} />
                    <Route path="/evaluations/:id" element={<EvaluationForm />} />
                    <Route path="/evaluations" element={<EvaluationsList />} />
                    <Route path="/evaluation-runs/:id" element={<EvaluationRuns />} />
                    <Route path="/eval-runs" element={<EvalRuns />} />
                    <Route path="/functions/:id/edit" element={<FunctionForm />} />
                    <Route path="/functions/:id" element={<FunctionView />} />
                    <Route path="/functions" element={<FunctionsList />} />
                    <Route path="/graphs" element={<IndexesList />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/imagegen" element={<ImageGen />} />
                    <Route path="/indexes/:id" element={<IndexForm />} />
                    <Route path="/indexes" element={<IndexesList />} />
                    <Route path="/mirrors/:id" element={<MirrorForm />} />
                    <Route path="/mirrors" element={<MirrorsList />} />
                    <Route path="/models/:id/edit" element={<ModelForm />} />
                    <Route path="/models/:id" element={<ModelView />} />
                    <Route path="/models" element={<ModelsList />} />
                    {/* <Route path="/profile" element={<ProfileView />} /> */}
                    <Route path="/prompt-sets/:id/edit" element={<PromptSetForm />} />
                    <Route path="/prompt-sets/:id" element={<PromptSetView />} />
                    <Route path="/prompt-sets" element={<PromptSetsList />} />
                    <Route path="/rag" element={<RagTester />} />
                    <Route path="/secrets" element={<Secrets />} />
                    <Route path="/traces/:id" element={<TraceView />} />
                    <Route path="/traces" element={<TracesList />} />
                    <Route path="/traces-dash" element={<TracesDashboard />} />
                    <Route path="/datasets" element={<TrainingList />} />
                    <Route path="/rules/:id" element={<RuleForm />} />
                    <Route path="/rules" element={<RulesList />} />
                    <Route path="/settings/:id" element={<SettingsForm />} />
                    <Route path="/settings" element={<SettingsList />} />
                    <Route path="/transformations/:id" element={<TransformationForm />} />
                    <Route path="/transformations" element={<TransformationsList />} />
                    <Route path="/uploads" element={<FileUploader />} />
                    <Route path="/users/:id/edit" element={<UserForm />} />
                    <Route path="/users/:id" element={<ProfileView />} />
                    <Route path="/users" element={<UsersList />} />
                    <Route path="/workspaces/:id" element={<WorkspaceForm />} />
                    <Route path="/workspaces" element={<WorkspacesList />} />
                    <Route path="/" element={<Home />} />
                  </Routes>
                </Content>
                <Footer style={{ textAlign: 'center' }}>Prompt Store ©2025</Footer>
              </Layout>
            </Layout>
          </WithPrivateRoute>
        } />
      </>
    )
  );
};

export default router;