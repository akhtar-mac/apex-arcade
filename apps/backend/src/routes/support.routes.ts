import { Router, Request, Response } from 'express';
import { requireRole } from '../middlewares/require-role.middleware.js';
import { SupportService } from '../services/support.service.js';

export const supportRouter = Router();

// ==========================================
// PLAYER ENDPOINTS
// ==========================================

// Get player tickets
supportRouter.get('/tickets', requireRole('USER', 'AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const tickets = await SupportService.getUserTickets(userId);
    return res.json({ success: true, data: tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Create new player ticket
supportRouter.post('/tickets', requireRole('USER', 'AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { subject, category, message, attachments } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Please enter a message for support.' });
    }
    const ticket = await SupportService.createTicket(
      userId,
      subject || 'Help Desk Query',
      category || 'PAYMENT',
      message,
      attachments
    );
    return res.json({ success: true, data: ticket });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get ticket conversation thread
supportRouter.get('/tickets/:id', requireRole('USER', 'AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;
    const isStaff = role === 'ADMIN' || role === 'AGENT';
    const ticket = await SupportService.getTicketDetails(req.params.id, userId, isStaff);
    return res.json({ success: true, data: ticket });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: err.message });
  }
});

// Player sends message in ticket
supportRouter.post('/tickets/:id/messages', requireRole('USER', 'AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { message, attachments } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }
    const newMessage = await SupportService.addMessage(
      req.params.id,
      user.userId,
      user.role === 'ADMIN' ? 'ADMIN' : user.role === 'AGENT' ? 'AGENT' : 'USER',
      user.fullName || `User #${user.phoneNumber?.slice(-4) || 'VIP'}`,
      message,
      attachments
    );
    return res.json({ success: true, data: newMessage });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ==========================================
// HELP DESK OPERATOR ENDPOINTS
// ==========================================

// List all support tickets for Help Desk staff
supportRouter.get('/admin/tickets', requireRole('AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;
    const tickets = await SupportService.getAllTickets({
      status: typeof status === 'string' ? status : undefined,
      category: typeof category === 'string' ? category : undefined,
      search: typeof search === 'string' ? search : undefined,
    });
    return res.json({ success: true, data: tickets });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get ticket details for Help Desk staff (includes customer wallet/tx context)
supportRouter.get('/admin/tickets/:id', requireRole('AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const ticket = await SupportService.getTicketDetails(req.params.id, undefined, true);
    return res.json({ success: true, data: ticket });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: err.message });
  }
});

// Operator reply to ticket
supportRouter.post('/admin/tickets/:id/reply', requireRole('AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { message, attachments } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Reply message cannot be empty.' });
    }
    const newMessage = await SupportService.addMessage(
      req.params.id,
      user.userId,
      user.role === 'ADMIN' ? 'ADMIN' : 'AGENT',
      user.fullName || 'Help Desk Official',
      message,
      attachments
    );
    return res.json({ success: true, data: newMessage });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// Operator update ticket status
supportRouter.patch('/admin/tickets/:id/status', requireRole('AGENT', 'ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, note } = req.body;
    if (!status || !['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }
    const updated = await SupportService.updateTicketStatus(req.params.id, status, user.userId, note);
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

