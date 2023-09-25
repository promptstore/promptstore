import { configureStore } from '@reduxjs/toolkit';

import agentsReducer from '../features/agents/agentsSlice';
import appsReducer from '../features/apps/appsSlice';
import authReducer from '../authSlice';
import chatReducer from '../features/designer/chatSlice';
import chatSessionsReducer from '../features/designer/chatSessionsSlice';
import compositionsReducer from '../features/composer/compositionsSlice';
import contentReducer from '../features/apps/Playground/contentSlice';
import dataSourcesReducer from '../features/dataSources/dataSourcesSlice';
import destinationsReducer from '../features/destinations/destinationsSlice';
import fileUploaderReducer from '../features/uploader/fileUploaderSlice';
import functionsReducer from '../features/functions/functionsSlice';
import guardrailsReducer from '../features/functions/guardrailsSlice';
import hfModelsReducer from '../features/models/hfModelsSlice';
import indexesReducer from '../features/indexes/indexesSlice';
import modelProvidersReducer from '../features/models/modelProvidersSlice';
import modelsReducer from '../features/models/modelsSlice';
import outputParsersReducer from '../features/functions/outputParsersSlice';
import promptSetsReducer from '../features/promptSets/promptSetsSlice';
import settingsReducer from '../features/promptSets/settingsSlice';
import templatesReducer from '../features/promptSets/templatesSlice';
import tracesReducer from '../features/traces/tracesSlice';
import trainingReducer from '../features/training/trainingSlice';
import transformationsReducer from '../features/transformations/transformationsSlice';
import usersReducer from '../features/users/usersSlice';
import workspacesReducer from '../features/workspaces/workspacesSlice';

export const store = configureStore({
  reducer: {
    agents: agentsReducer,
    apps: appsReducer,
    auth: authReducer,
    chat: chatReducer,
    chatSessions: chatSessionsReducer,
    compositions: compositionsReducer,
    content: contentReducer,
    dataSources: dataSourcesReducer,
    destinations: destinationsReducer,
    fileUploader: fileUploaderReducer,
    functions: functionsReducer,
    guardrails: guardrailsReducer,
    hfModels: hfModelsReducer,
    indexes: indexesReducer,
    modelProviders: modelProvidersReducer,
    models: modelsReducer,
    outputParsers: outputParsersReducer,
    promptSets: promptSetsReducer,
    settings: settingsReducer,
    templates: templatesReducer,
    traces: tracesReducer,
    training: trainingReducer,
    transformations: transformationsReducer,
    users: usersReducer,
    workspaces: workspacesReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
