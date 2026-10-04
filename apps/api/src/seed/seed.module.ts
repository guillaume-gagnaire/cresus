import { Module } from '@nestjs/common';
import { DataModule } from '../data/data.module.js';
import { SeedService } from './seed.service.js';

@Module({ imports: [DataModule], providers: [SeedService], exports: [SeedService] })
export class SeedModule {}
