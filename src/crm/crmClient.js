import { CONFIG } from '../config.js';
import { genericProvider } from './providers/generic.js';
import { squireProvider } from './providers/squire.js';
import { squareupProvider } from './providers/squareup.js';

const providers = { 
  generic: genericProvider, 
  squire: squireProvider,
  squareup: squareupProvider,
};

export const crmClient = providers[CONFIG.crm.provider] || genericProvider;
