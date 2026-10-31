import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type {
  CreateChatRequest,
  CreateChatResponse,
} from '@tumy/mobile-chat-grpc/gen/createChat.js';
import type {
  AllChat,
  DirectChatRequest,
  DirectChatResponse,
  GetChatListRequest,
  GetChatMembersRequest,
  ChatMembers,
} from '@tumy/mobile-chat-grpc/gen/chat.js';
import type {
  GetMessagesRequest,
  MessageList,
  MessageResponse,
  SendMessageRequest,
} from '@tumy/mobile-chat-grpc/gen/messages.js';

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
        memberIds: chat.members.map((member) => member.userId),
        isDirect: chat.isDirect,
      })),
    };
  }

  @GrpcMethod('directChatService', 'ensureDirectChat')
  async ensureDirectChat(data: DirectChatRequest): Promise<DirectChatResponse> {
    if (!data.userId || !data.peerId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібні userId та peerId',
      });
    }

    if (data.userId === data.peerId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Не можна відкривати ЛС з самим собою',
      });
    }

    const chat = await this.chatService.ensureDirectChat(
      data.userId,
      data.peerId,
    );

    return { chatId: chat.id };
  }

  @GrpcMethod('getChatMembersService', 'getChatMembers')
  async getChatMembers(data: GetChatMembersRequest): Promise<ChatMembers> {
    if (!data.chatId || !data.userId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібні chatId та userId',
      });
    }

    const members = await this.chatService.getMembers(data.chatId, data.userId);

    return {
      members: members.map((member) => ({
        userId: member.userId,
        role: member.role,
      })),
    };
  }

  @GrpcMethod('sendMessage', 'send')
  async send(data: SendMessageRequest): Promise<MessageResponse> {
    if (!data.chatId || !data.authorId || !data.text?.trim()) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібні chatId, authorId та текст',
      });
    }

    if (data.text.trim().length > 2000) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Текст не може перевищувати 2000 символів',
      });
    }

    return this.chatService.sendMessage(
      data.chatId,
      data.authorId,
      data.text.trim(),
    );
  }

  @GrpcMethod('getMessages', 'get')
  async getMessages(data: GetMessagesRequest): Promise<MessageList> {
    if (!data.chatId || !data.userId) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Потрібні chatId та userId',
      });
    }

    const messages = await this.chatService.getMessages(
      data.chatId,
      data.userId,
    );

    return { messages };
  }
}
