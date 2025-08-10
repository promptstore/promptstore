import { useContext, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, message, Spin } from 'antd';
import SchemaForm from '@rjsf/antd';
import validator from '@rjsf/validator-ajv8';
import startCase from 'lodash.startcase';

import NavbarContext from '../../contexts/NavbarContext';
import WorkspaceContext from '../../contexts/WorkspaceContext';
import { getAppAsync, selectApps } from './appsSlice';
import { getCompositionAsync, selectCompositions } from '../composer/compositionsSlice';
import { runCompositionExecution } from './executionSlice';

export function AppDynamicForm() {
  const [formData, setFormData] = useState({});
  const [schema, setSchema] = useState(null);
  const [uiSchema, setUiSchema] = useState({});
  const [loading, setLoading] = useState(true);

  const apps = useSelector(selectApps);
  const compositions = useSelector(selectCompositions);

  const { setNavbarState } = useContext(NavbarContext);
  const { selectedWorkspace } = useContext(WorkspaceContext);

  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();

  const [messageApi, contextHolder] = message.useMessage();

  const id = location.pathname.match(/\/apps\/(.*?)\/form/)[1];
  const app = apps[id];

  useEffect(() => {
    if (id) {
      dispatch(getAppAsync(id));
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (app && app.composition) {
      dispatch(getCompositionAsync(app.composition));
    }
  }, [app, dispatch]);

  // Helper function to generate UI schema with title case labels
  const generateUiSchema = schema => {
    const uiSchema = {
      'ui:submitButtonOptions': {
        submitText: 'Execute',
        norender: false,
        props: {
          type: 'primary',
          size: 'large',
        },
      },
    };

    if (schema?.properties) {
      Object.keys(schema.properties).forEach(key => {
        uiSchema[key] = {
          'ui:title': startCase(key),
        };

        // Handle nested objects
        if (schema.properties[key].type === 'object' && schema.properties[key].properties) {
          uiSchema[key] = {
            ...uiSchema[key],
            ...generateNestedUiSchema(schema.properties[key]),
          };
        }
      });
    }

    return uiSchema;
  };

  // Helper function for nested object properties
  const generateNestedUiSchema = nestedSchema => {
    const nestedUi = {};
    if (nestedSchema.properties) {
      Object.keys(nestedSchema.properties).forEach(key => {
        nestedUi[key] = {
          'ui:title': startCase(key),
        };
      });
    }
    return nestedUi;
  };

  useEffect(() => {
    if (app && app.composition && compositions[app.composition]) {
      const composition = compositions[app.composition];

      // Find the request node in the composition
      const requestNode = composition.flow.nodes?.find(node => node.type === 'requestNode');

      if (requestNode?.data?.arguments) {
        const schemaData = requestNode.data.arguments;
        setSchema(schemaData);
        setUiSchema(generateUiSchema(schemaData));
      } else {
        messageApi.error('No request node with schema found in composition');
      }
      setLoading(false);
    }
  }, [app, compositions, messageApi]);

  useEffect(() => {
    setNavbarState(state => ({
      ...state,
      createLink: null,
      title: app ? `${app.name}` : 'App Inputs',
    }));
  }, [app, setNavbarState]);

  const handleSubmit = async ({ formData }) => {
    try {
      if (!app || !app.composition || !selectedWorkspace) {
        messageApi.error('Missing required data for execution');
        return;
      }

      const composition = compositions[app.composition];
      if (!composition) {
        messageApi.error('Composition not found');
        return;
      }

      messageApi.loading('Executing composition...', 0);

      // Execute the composition with form data
      const compositionResult = await dispatch(
        runCompositionExecution({
          name: composition.name,
          args: formData,
          workspaceId: selectedWorkspace.id,
        })
      );

      messageApi.destroy();
      messageApi.success('Composition executed successfully!');

      // Navigate to results page with the composition result
      navigate(`/apps/${id}/results`, {
        state: {
          formData,
          compositionResult,
        },
      });
    } catch (error) {
      messageApi.destroy();
      messageApi.error(`Failed to execute composition: ${error.message}`);
      console.error('Composition execution error:', error);
    }
  };

  const handleError = errors => {
    console.log('Form validation errors:', errors);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!schema) {
    return (
      <div style={{ marginTop: 40 }}>
        {contextHolder}
        <Card>
          <p>
            No form schema available for this app. The app's composition must have a request node with an
            arguments schema.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 40 }}>
      {contextHolder}
      <Card title={`${app?.name || 'App'} - Inputs`}>
        <SchemaForm
          schema={schema}
          formData={formData}
          onChange={({ formData }) => setFormData(formData)}
          onSubmit={handleSubmit}
          onError={handleError}
          validator={validator}
          uiSchema={uiSchema}
        />
      </Card>
    </div>
  );
}
