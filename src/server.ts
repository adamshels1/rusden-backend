import app from './app';
import { env } from './config/env';

const PORT = env.PORT;

// Для локальной разработки
if (env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📋 API: http://localhost:${PORT}/api/listings`);
  });
}

// Для Vercel
export default app;
