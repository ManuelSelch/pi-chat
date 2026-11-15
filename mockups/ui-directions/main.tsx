import React from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './styles.css';
import './inbox.css';
import { App } from './App';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
