import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, message, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import DynamicCodeRenderer from './DynamicCodeRenderer';
import { getAppAsync, selectApps, saveAppJsxAsync } from './appsSlice';
import {
  runCompositionExecution,
  runSemanticFunction,
  selectExecutionResults,
  selectExecutionLoading,
} from './executionSlice';

export function AppResults() {
  const [jsxCode, setJsxCode] = useState(null);
  const [error, setError] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [usingCachedJsx, setUsingCachedJsx] = useState(false);

  const apps = useSelector(selectApps);
  const executionResults = useSelector(selectExecutionResults);
  const executionLoading = useSelector(selectExecutionLoading);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const id = location.pathname.match(/\/apps\/(.*?)\/results/)[1];
  const app = apps[id];
  const { formData, compositionResult } = location.state || {};

  // Helper function to create a hash of the composition result
  const createResultHash = (result) => {
    // Simple hash function that works with Unicode
    const jsonString = JSON.stringify(result);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 16);
  };

  const currentResultHash = compositionResult ? createResultHash(compositionResult.myargs) : null;

  useEffect(() => {
    if (id) {
      dispatch(getAppAsync(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    setNavbarState(state => ({
      ...state,
      createLink: null,
      title: app ? `${app.name}` : 'App Results',
    }));
  }, [app, setNavbarState]);

  useEffect(() => {
    const handleJsxGeneration = async () => {
      if (!compositionResult || !selectedWorkspace || !currentResultHash) return;

      // Check if we have cached JSX for this result
      if (app?.cachedJsx && app?.resultHash === currentResultHash) {
        console.log('Using cached JSX');
        setJsxCode(app.cachedJsx);
        setUsingCachedJsx(true);
        return;
      }

      // Generate new JSX
      await generateJsx();
    };

    handleJsxGeneration();
  }, [compositionResult, selectedWorkspace, app, currentResultHash]);

  const generateJsx = async () => {
    if (!compositionResult || !selectedWorkspace) return;

    try {
      setIsRegenerating(true);
      
      // Call the 'create_app_results_view' semantic function
      const result = await dispatch(
        runSemanticFunction({
          name: 'create_app_results_view',
          args: { data: compositionResult.myargs },
          workspaceId: selectedWorkspace.id,
        })
      );

      let generatedJsx = null;

      // Extract JSX from the result
      let args = result?.response?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        args = result?.response?.choices?.[0]?.message?.function_call?.arguments;
      }
      if (args) {
        let content = args;

        // TODO: for Anthropic
        if ('input' in args) {
          content = args.input;
        }

        // Try to parse JSON response first
        try {
          const parsed = JSON.parse(content);
          generatedJsx = parsed.jsx || content;
        } catch {
          // If not JSON, treat as direct JSX
          generatedJsx = content;
        }
      } else {
        throw new Error('No JSX content found in semantic function result');
      }

      if (generatedJsx) {
        setJsxCode(generatedJsx);
        setUsingCachedJsx(false);

        // Save the generated JSX to the app
        if (app && currentResultHash) {
          dispatch(saveAppJsxAsync({
            id: app.id,
            jsxCode: generatedJsx,
            resultHash: currentResultHash,
          }));
        }
      }
    } catch (error) {
      console.error('Error calling create_app_results_view:', error);
      setError(`Failed to generate results view: ${error.message}`);
      messageApi.error('Failed to generate results view');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRegenerate = () => {
    setJsxCode(null);
    setError(null);
    generateJsx();
  };

  if (executionLoading || isRegenerating) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: 40 }}>
        {contextHolder}
        <Card>
          <p>{error}</p>
          <Button onClick={() => navigate(`/apps/${id}/form`)}>Back to Form</Button>
        </Card>
      </div>
    );
  }

  if (!jsxCode) {
    return (
      <div style={{ marginTop: 40 }}>
        {contextHolder}
        <Card>
          <p>No results to display.</p>
          <Button onClick={() => navigate(`/apps/${id}/form`)}>Back to Form</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 40 }}>
      {contextHolder}
      <Card
        title={`${app?.name || 'App'} - Results`}
        extra={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRegenerate}
              disabled={isRegenerating}
              title={usingCachedJsx ? "Regenerate JSX" : "Refresh"}
            >
              {usingCachedJsx ? "Regenerate" : "Refresh"}
            </Button>
            <Button onClick={() => navigate(`/apps/${id}/form`)}>
              Back to Form
            </Button>
          </div>
        }
      >
        {usingCachedJsx && (
          <div style={{ 
            marginBottom: '16px', 
            padding: '8px 12px', 
            backgroundColor: '#f6ffed', 
            border: '1px solid #b7eb8f',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#389e0d'
          }}>
            ♻️ Using cached results - Click "Regenerate" to create fresh JSX
          </div>
        )}
        <DynamicCodeRenderer code={jsxCode} type="jsx" props={{ data: compositionResult?.myargs || {} }} />
      </Card>
    </div>
  );
}
