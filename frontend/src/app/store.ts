import { configureStore } from '@reduxjs/toolkit';
import appsReducer from '../features/apps/appsSlice';
import authReducer from '../authSlice';
import chatReducer from '../features/apps/Playground/chatSlice';
import chatSessionsReducer from '../features/designer/chatSessionsSlice';
import compositionsReducer from '../features/composer/compositionsSlice';
import contentReducer from '../features/apps/Playground/contentSlice';
import dataSourcesReducer from '../features/dataSources/dataSourcesSlice';
import fileUploaderReducer from '../features/uploader/fileUploaderSlice';
import functionsReducer from '../features/functions/functionsSlice';
import hfModelsReducer from '../features/models/hfModelsSlice';
import indexesReducer from '../features/indexes/indexesSlice';
import modelsReducer from '../features/models/modelsSlice';
import promptSetsReducer from '../features/promptSets/promptSetsSlice';
import reviewsReducer from '../features/reviews/reviewsSlice';
import settingsReducer from '../features/promptSets/settingsSlice';
import templatesReducer from '../features/promptSets/templatesSlice';
import trainingReducer from '../features/training/trainingSlice';
import usersReducer from '../features/users/usersSlice';
import viewerReducer from '../features/Viewer/viewerSlice';
import workspacesReducer from '../features/workspaces/workspacesSlice';

export const store = configureStore({
  reducer: {
    apps: appsReducer,
    auth: authReducer,
    chat: chatReducer,
    chatSessions: chatSessionsReducer,
    compositions: compositionsReducer,
    content: contentReducer,
    dataSources: dataSourcesReducer,
    fileUploader: fileUploaderReducer,
    functions: functionsReducer,
    hfModels: hfModelsReducer,
    indexes: indexesReducer,
    models: modelsReducer,
    promptSets: promptSetsReducer,
    reviews: reviewsReducer,
    settings: settingsReducer,
    templates: templatesReducer,
    training: trainingReducer,
    users: usersReducer,
    viewer: viewerReducer,
    workspaces: workspacesReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
