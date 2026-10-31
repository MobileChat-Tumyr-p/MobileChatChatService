import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import type { MessageResponse } from '@tumy/mobile-chat-grpc/gen/messages.js';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  public async create(ownerId: number, title: string, memberIds: number[]) {
    const members = Array.from(new Set([ownerId, ...memberIds]));

    return this.prisma.chat.create({
      data: {
        title,
        ownerId,
        members: {
          create: members.map((userId) => ({
            userId,
            role: userId === ownerId ? 'owner' : 'member',
          })),
        },
      },
      include: { members: true },
    });
  }

  public async ensureDirectChat(userId: number, peerId: number) {
    const candidates = await this.prisma.chat.findMany({
      where: {
        isDirect: true,
        members: { some: { userId } },
      },
      include: { members: true },
    });

    const existing = candidates.find(
      (chat) =>
        chat.members.length === 2 &&
        chat.members.some((member) => member.userId === userId) &&
        chat.members.some((member) => member.userId === peerId),
    );

    if (existing) {
      return existing;
    }

    return this.prisma.chat.create({
      data: {
        title: '',
        ownerId: userId,
        isDirect: true,
        members: {
          create: [
            { userId, role: 'owner' },
            { userId: peerId, role: 'member' },
          ],
        },
      },
      include: { members: true },
    });
  }

  public async list(userId: number) {
    return this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  public async sendMessage(
    chatId: number,
    authorId: number,
    text: string,
  ): Promise<MessageResponse> {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });

    if (!chat) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'Чат не знайдено',
      });
    }

    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId: authorId },
    });

    if (!membership) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Ви не учасник цього чату',
      });
    }

    const message = await this.prisma.message.create({
      data: { chatId, authorId, text },
    });

    await this.prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    return {
      id: message.id,
      chatId: message.chatId,
      authorId: message.authorId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    };
  }

  public async getMembers(chatId: number, userId: number) {
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
    });

    if (!membership) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Ви не учасник цього чату',
      });
    }

    return this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true, role: true },
      orderBy: { userId: 'asc' },
    });
  }

  public async getMessages(
    chatId: number,
    userId: number,
    limit: number,
    offset: number,
  ) {
    const membership = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
    });

    if (!membership) {
      throw new RpcException({
        code: status.PERMISSION_DENIED,
        message: 'Ви не учасник цього чату',
      });
    }

    // Сторінка від найновіших: offset відступає від кінця історії,
    // take обрізає до limit. Пагінація за автоінкрементом id надійна
    // навіть при однакових createdAt.
    const take = limit > 0 ? limit : 30;

    const messages = await this.prisma.message.findMany({
      where: { chatId },
      orderBy: { id: 'desc' },
      skip: offset > 0 ? offset : undefined,
      take,
    });

    return messages.reverse().map((message) => ({
      id: message.id,
      chatId: message.chatId,
      authorId: message.authorId,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })).reverse();
  }
}
