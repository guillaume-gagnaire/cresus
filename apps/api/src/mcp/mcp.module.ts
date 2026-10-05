import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DataModule } from '../data/data.module.js';
import { McpService } from './mcp.server.js';

/** Serveur MCP (outils de gestion de la trésorerie). Le montage Express de `/mcp` est fait par `mountMcp`, dans bootstrap. */
@Module({
  imports: [AuthModule, DataModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
