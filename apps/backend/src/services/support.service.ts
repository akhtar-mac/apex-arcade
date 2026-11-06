import { getPrisma } from '../db.js';
import { GameEngineService } from './game-engine.service.js';
import { Ledger } from './ledger.service.js';

export class SupportService {
  /**
   * Create a new support ticket by a player
   */
  static async createTicket(
    userId: string,
    subject: string,
    category: string = 'PAYMENT',
    initialMessage: string,
    attachments?: string
  ) {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, phoneNumber: true }
    });

    const senderName = user?.fullName || `User #${user?.phoneNumber?.slice(-4) || 'VIP'}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject: subject.trim().slice(0, 150) || 'Help Desk Inquiry',
        category: category.toUpperCase(),
        status: 'OPEN',
        messages: {
          create: {
            senderId: userId,
            senderRole: 'USER',
            senderName,
            message: initialMessage.trim(),
            attachments: attachments || null
          }
        }
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { phoneNumber: true, fullName: true } }
      }
    });

    const io = GameEngineService.getIo();
    if (io) {
      io.to('role:AGENT').to('role:ADMIN').emit('desk:support:new-ticket', {
        ticketId: ticket.id,
        userId,
        phoneNumber: user?.phoneNumber,
        subject: ticket.subject,
        category: ticket.category,
        createdAt: ticket.createdAt
      });
    }

    return ticket;
  }

  /**
   * Get all tickets for a specific player
   */
  static async getUserTickets(userId: string) {
    const prisma = getPrisma();
    return prisma.supportTicket.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
  }

  /**
   * Get detailed ticket thread with all messages and customer overview
   */
  static async getTicketDetails(ticketId: string, userId?: string, isStaff: boolean = false) {
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: {
          select: {
            id: true,
            phoneNumber: true,
            fullName: true,
            wallet: { select: { balance: true, locked: true, unwagered: true } },
            transactions: {
              where: { type: { in: ['DEPOSIT', 'WITHDRAWAL'] } },
              orderBy: { createdAt: 'desc' },
              take: 3,
              select: { id: true, type: true, status: true, amount: true, utrNumber: true, createdAt: true }
            }
          }
        }
      }
    });

    if (!ticket) throw new Error('Support ticket not found');
    if (!isStaff && userId && ticket.userId !== userId) {
      throw new Error('Unauthorized to view this ticket');
    }

    return ticket;
  }

  /**
   * Send a reply message in an existing ticket thread
   */
  static async addMessage(
    ticketId: string,
    senderId: string,
    senderRole: 'USER' | 'AGENT' | 'ADMIN',
    senderName: string,
    messageText: string,
    attachments?: string
  ) {
    const prisma = getPrisma();
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: { select: { phoneNumber: true } } }
    });

    if (!ticket) throw new Error('Ticket not found');

    const newStatus = senderRole === 'USER' ? 'OPEN' : 'IN_PROGRESS';

    const [newMessage] = await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId,
          senderId,
          senderRole,
          senderName,
          message: messageText.trim(),
          attachments: attachments || null
        }
      }),
      prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? newStatus : undefined,
          updatedAt: new Date()
        }
      })
    ]);

    const io = GameEngineService.getIo();
    if (io) {
      if (senderRole === 'USER') {
        io.to('role:AGENT').to('role:ADMIN').emit('desk:support:new-message', {
          ticketId,
          senderId,
          senderName,
          message: newMessage.message,
          createdAt: newMessage.createdAt,
          userPhone: ticket.user.phoneNumber
        });
      } else {
        io.to(`user:${ticket.userId}`).emit('support:message', {
          ticketId,
          messageId: newMessage.id,
          senderName,
          senderRole,
          message: newMessage.message,
          createdAt: newMessage.createdAt
        });
      }
    }

    return newMessage;
  }

  /**
   * Help Desk Staff: Query all customer support tickets
   */
  static async getAllTickets(filter?: { status?: string; category?: string; search?: string }) {
    const prisma = getPrisma();
    const where: any = {};

    if (filter?.status && filter.status !== 'ALL') {
      where.status = filter.status;
    }
    if (filter?.category && filter.category !== 'ALL') {
      where.category = filter.category;
    }
    if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { subject: { contains: q, mode: 'insensitive' } },
        { user: { phoneNumber: { contains: q } } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } }
      ];
    }

    return prisma.supportTicket.findMany({
      where,
      include: {
        user: { select: { phoneNumber: true, fullName: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
  }

  /**
   * Update Ticket Status (Resolve, Close, In Progress)
   */
  static async updateTicketStatus(
    ticketId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    staffId: string,
    note?: string
  ) {
    const prisma = getPrisma();
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date(), assignedTo: staffId }
    });

    await Ledger.recordDeskAction(staffId, `support.ticket.${status.toLowerCase()}`, ticketId, note || `Status updated to ${status}`);

    const io = GameEngineService.getIo();
    if (io) {
      io.to(`user:${updated.userId}`).emit('support:status', {
        ticketId,
        status: updated.status
      });
      io.to('role:AGENT').to('role:ADMIN').emit('desk:support:status-updated', {
        ticketId,
        status: updated.status,
        staffId
      });
    }

    return updated;
  }
}
