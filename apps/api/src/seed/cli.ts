import { createApp } from '../bootstrap.js';
import { loadConfig } from '../config.js';
import { SeedService } from './seed.service.js';

const app = await createApp(loadConfig());
await app.init();
await app.get(SeedService).ensureDemoUser();
await app.close();
console.log('Seed terminé.');
