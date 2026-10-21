import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const url = process.env.CHAT_PORT ?? '0.0.0.0:50051';

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: ['create.v1', 'chat.v1'],
        protoPath: [
          'node_modules/@tumy/mobile-chat-grpc/proto/createChat.proto',
          'node_modules/@tumy/mobile-chat-grpc/proto/chat.proto',
          'node_modules/@tumy/mobile-chat-grpc/proto/messages.proto',
        ],
        url,
        loader: {
          keepCase: false,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        },
      },
    },
  );

  await app.listen();
  console.log('Chat gRPC microservice is running on', url);
}

await bootstrap();
