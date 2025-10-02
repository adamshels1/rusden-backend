import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import listingsRoutes from './routes/listings.routes';
import cronRoutes from './routes/cron.routes';
import { swaggerSpec } from './config/swagger';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для Swagger UI
}));

// CORS - разрешаем публичный доступ из любых источников
app.use(cors({
  origin: '*', // Разрешаем все источники (публичный API)
  methods: ['GET'], // Только GET запросы для публичного API
  credentials: false,
}));

app.use(express.json());
app.use(morgan('dev'));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Rusden API Documentation',
}));

// Swagger JSON
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Проверка состояния сервера
 *     description: Возвращает статус работы сервера
 *     responses:
 *       200:
 *         description: Сервер работает
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
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
