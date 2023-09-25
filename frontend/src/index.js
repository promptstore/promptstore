import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ThemeProvider, CSSReset } from '@chakra-ui/core';

import App from './App';
import { store } from './app/store';
import * as serviceWorker from './serviceWorker';

import './index.css';

const container = document.getElementById('app');
const root = createRoot(container);
root.render(
  <Provider store={store}>
    <ThemeProvider>
      <CSSReset />
      <App />
    </ThemeProvider>
  </Provider>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
