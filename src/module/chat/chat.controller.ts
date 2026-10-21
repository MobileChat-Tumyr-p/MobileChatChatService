import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type {
  CreateChatRequest,
  CreateChatResponse,
} from '@tumy/mobile-chat-grpc/gen/createChat.js';
import type {
  AllChat,
  GetChatListRequest,
} from '@tumy/mobile-chat-grpc/gen/chat.js';

import { ChatService } from './chat.service.js';

@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @GrpcMethod('createChat', 'create')
  async create(data: CreateChatRequest): Promise<CreateChatResponse> {
    if (!data.ownerId || !data.title?.trim()) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібні title та ownerId',
      });
    }

    const chat = await this.chatService.create(
      data.ownerId,
      data.title.trim(),
      data.memberIds ?? [],
    );

    return {
      id: chat.id,
      title: chat.title,
      ownerId: chat.ownerId,
      members: chat.members.length,
      createdAt: chat.createdAt.toISOString(),
    };
  }

  @GrpcMethod('getChatListService', 'getChat')
  async getChat(data: GetChatListRequest): Promise<AllChat> {
    if (!data.userId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібен userId',
      });
    }

    const chats = await this.chatService.list(data.userId);

    return {
      list: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        lastMessage: chat.messages[0]?.text ?? '',
        updatedAt: chat.updatedAt.toISOString(),
        unreadCount: 0,
        members: chat.members.length,
      })),
    };
  }
}
