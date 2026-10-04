import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp(config);
await app.listen(config.port);
console.log(`Ma Tréso API sur http://localhost:${config.port}/api`);
