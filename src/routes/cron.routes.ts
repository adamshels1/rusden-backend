import { Router } from 'express';
import { parseChannelsJob } from '../jobs/parseChannels.job';

const router = Router();

// Middleware для проверки секретного ключа (защита cron endpoint)
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};

// POST /api/cron/parse - запуск парсинга (защищен токеном)
router.post('/parse', authMiddleware, async (req, res) => {
  try {
    await parseChannelsJob();
    res.json({ success: true, message: 'Parsing job completed' });
  } catch (error: any) {
    console.error('Cron job error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
