import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { App } from './App';
import './styles.css';
if (import.meta.env.DEV) await import('react-grab');
const theme = createTheme({ primaryColor: 'blue', defaultRadius: 'sm', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' });
createRoot(document.getElementById('root')!).render(<MantineProvider theme={theme} defaultColorScheme="light"><App/></MantineProvider>);
