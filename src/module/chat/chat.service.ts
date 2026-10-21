import { Injectable } from '@nestjs/common';
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
}
