import { configureStore } from '@reduxjs/toolkit';

import adminFunctionsReducer from '../features/adminFunctions/adminFunctionsSlice';
import agentNetworksReducer from '../features/agentNetworks/agentNetworksSlice';
import agentsReducer from '../features/agents/agentsSlice';
import appUploaderReducer from '../features/apps/appUploaderSlice';
import appsReducer from '../features/apps/appsSlice';
import authReducer from '../authSlice';
import chatReducer from '../features/designer/chatSlice';
import chatSessionsReducer from '../features/designer/chatSessionsSlice';
import chunksReducer from '../features/indexes/chunksSlice';
import compositionsReducer from '../features/composer/compositionsSlice';
import contentReducer from '../features/apps/Playground/contentSlice';
import dataSourcesReducer from '../features/dataSources/dataSourcesSlice';
import destinationsReducer from '../features/destinations/destinationsSlice';
import embeddingReducer from '../features/uploader/embeddingSlice';
import evaluationRunsReducer from '../features/evaluations/evaluationRunsSlice';
import evaluationsReducer from '../features/evaluations/evaluationsSlice';
import extractorsReducer from '../features/composer/extractorsSlice';
import fileUploaderReducer from '../features/uploader/fileUploaderSlice';
import functionsReducer from '../features/functions/functionsSlice';
import graphsReducer from '../features/indexes/graphsSlice';
import graphStoresReducer from '../features/uploader/graphStoresSlice';
import guardrailsReducer from '../features/functions/guardrailsSlice';
import hfModelsReducer from '../features/models/hfModelsSlice';
import imagesReducer from '../features/imagegen/imagesSlice';
import indexesReducer from '../features/indexes/indexesSlice';
import loadersReducer from '../features/composer/loadersSlice';
import mirrorsReducer from '../features/mirrors/mirrorsSlice';
import modelProvidersReducer from '../features/models/modelProvidersSlice';
import modelsReducer from '../features/models/modelsSlice';
import outputParsersReducer from '../features/functions/outputParsersSlice';
import promptSetsReducer from '../features/promptSets/promptSetsSlice';
import rulesReducer from '../features/rules/rulesSlice';
import secretsReducer from '../features/secrets/secretsSlice';
import settingsReducer from '../features/settings/settingsSlice';
import statisticsReducer from '../features/home/statisticsSlice';
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
    adminFunctions: adminFunctionsReducer,
    agentNetworks: agentNetworksReducer,
    agents: agentsReducer,
    appUploader: appUploaderReducer,
    apps: appsReducer,
    auth: authReducer,
    chat: chatReducer,
    chatSessions: chatSessionsReducer,
    chunks: chunksReducer,
    compositions: compositionsReducer,
    content: contentReducer,
    dataSources: dataSourcesReducer,
    destinations: destinationsReducer,
    embedding: embeddingReducer,
    evaluationRuns: evaluationRunsReducer,
    evaluations: evaluationsReducer,
    extractors: extractorsReducer,
    fileUploader: fileUploaderReducer,
    functions: functionsReducer,
    graphs: graphsReducer,
    graphStores: graphStoresReducer,
    guardrails: guardrailsReducer,
    hfModels: hfModelsReducer,
    images: imagesReducer,
    indexes: indexesReducer,
    loaders: loadersReducer,
    mirrors: mirrorsReducer,
    modelProviders: modelProvidersReducer,
    models: modelsReducer,
    outputParsers: outputParsersReducer,
    promptSets: promptSetsReducer,
    rules: rulesReducer,
    secrets: secretsReducer,
    settings: settingsReducer,
    statistics: statisticsReducer,
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
