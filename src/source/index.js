import { config } from '../config.js';

export const source =
  config.source === 'graph'
    ? await import('./graphSource.js')
    : await import('./localSource.js');