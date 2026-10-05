import { Body, Controller, Patch } from '@nestjs/common';
import type { UserProfileDto } from '@matreso/engine';
import type { z } from 'zod';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { profilePatchSchema, ProfileService } from './profile.service.js';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Patch()
  patch(@CurrentUser() userId: string, @Body(new ZodPipe(profilePatchSchema)) body: z.infer<typeof profilePatchSchema>): Promise<UserProfileDto> {
    return this.profile.patch(userId, body);
  }
}
