import { createRoot } from 'react-dom/client';
import { createTheme, MantineProvider } from '@mantine/core';
import { Agentation } from 'agentation';
import '@mantine/core/styles.css';
import { App } from './App';
import './styles.css';

const theme = createTheme({ primaryColor: 'blue', defaultRadius: 'md', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' });
createRoot(document.getElementById('root')!).render(<MantineProvider theme={theme} forceColorScheme="dark"><App/>{import.meta.env.DEV && <Agentation/>}</MantineProvider>);
