import { Controller, Get } from '@nestjs/common';
import type { StateDto } from '@matreso/engine';
import { CurrentUser } from '../common/current-user.decorator.js';
import { StateService } from './state.service.js';

@Controller('state')
export class StateController {
  constructor(private readonly state: StateService) {}

  @Get()
  get(@CurrentUser() userId: string): Promise<StateDto> {
    return this.state.getState(userId);
  }
}
