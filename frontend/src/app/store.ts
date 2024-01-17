import { configureStore } from '@reduxjs/toolkit';

import agentsReducer from '../features/agents/agentsSlice';
import appUploaderReducer from '../features/apps/appUploaderSlice';
import appsReducer from '../features/apps/appsSlice';
import authReducer from '../authSlice';
import chatReducer from '../features/designer/chatSlice';
import chatSessionsReducer from '../features/designer/chatSessionsSlice';
import compositionsReducer from '../features/composer/compositionsSlice';
import contentReducer from '../features/apps/Playground/contentSlice';
import dataSourcesReducer from '../features/dataSources/dataSourcesSlice';
import destinationsReducer from '../features/destinations/destinationsSlice';
import embeddingReducer from '../features/uploader/embeddingSlice';
import evaluationsReducer from '../features/evaluations/evaluationsSlice';
import fileUploaderReducer from '../features/uploader/fileUploaderSlice';
import functionsReducer from '../features/functions/functionsSlice';
import graphStoresReducer from '../features/uploader/graphStoresSlice';
import guardrailsReducer from '../features/functions/guardrailsSlice';
import hfModelsReducer from '../features/models/hfModelsSlice';
import indexesReducer from '../features/indexes/indexesSlice';
import modelProvidersReducer from '../features/models/modelProvidersSlice';
import modelsReducer from '../features/models/modelsSlice';
import outputParsersReducer from '../features/functions/outputParsersSlice';
import promptSetsReducer from '../features/promptSets/promptSetsSlice';
import settingsReducer from '../features/promptSets/settingsSlice';
import templatesReducer from '../features/promptSets/templatesSlice';
import toolsReducer from '../features/agents/toolsSlice';
import traceAnalyticsReducer from '../features/traces/traceAnalyticsSlice';
import tracesReducer from '../features/traces/tracesSlice';
import trainingReducer from '../features/training/trainingSlice';
import transformationsReducer from '../features/transformations/transformationsSlice';
import usersReducer from '../features/users/usersSlice';
import workspacesReducer from '../features/workspaces/workspacesSlice';
import vectorStoresReducer from '../features/uploader/vectorStoresSlice';

export const store = configureStore({
  reducer: {
    agents: agentsReducer,
    appUploader: appUploaderReducer,
    apps: appsReducer,
    auth: authReducer,
    chat: chatReducer,
    chatSessions: chatSessionsReducer,
    compositions: compositionsReducer,
    content: contentReducer,
    dataSources: dataSourcesReducer,
    destinations: destinationsReducer,
    embedding: embeddingReducer,
    evaluations: evaluationsReducer,
    fileUploader: fileUploaderReducer,
    functions: functionsReducer,
    graphStores: graphStoresReducer,
    guardrails: guardrailsReducer,
    hfModels: hfModelsReducer,
    indexes: indexesReducer,
    modelProviders: modelProvidersReducer,
    models: modelsReducer,
    outputParsers: outputParsersReducer,
    promptSets: promptSetsReducer,
    settings: settingsReducer,
    templates: templatesReducer,
    tools: toolsReducer,
    traceAnalytics: traceAnalyticsReducer,
    traces: tracesReducer,
    training: trainingReducer,
    transformations: transformationsReducer,
    users: usersReducer,
    workspaces: workspacesReducer,
    vectorStores: vectorStoresReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
