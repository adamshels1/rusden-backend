import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import listingsRoutes from './routes/listings.routes';
import cronRoutes from './routes/cron.routes';

const app = express();

// Middleware
app.use(helmet());

// CORS - разрешаем публичный доступ из любых источников
app.use(cors({
  origin: '*', // Разрешаем все источники (публичный API)
  methods: ['GET'], // Только GET запросы для публичного API
  credentials: false,
}));

app.use(express.json());
app.use(morgan('dev'));

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Публичный API - без авторизации
app.use('/api/listings', listingsRoutes);

// Cron endpoints - защищены токеном
app.use('/api/cron', cronRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

export default app;
