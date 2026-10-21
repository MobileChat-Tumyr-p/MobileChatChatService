import { Module } from '@nestjs/common';

import { ChatModule } from './module/chat/chat.module.js';

@Module({
  imports: [ChatModule],
})
export class AppModule {}
