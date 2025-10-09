import app from './app';
import { env } from './config/env';

const PORT = env.PORT;

// Запускаем сервер в любой среде
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API: http://localhost:${PORT}/api/listings`);
  console.log(`📚 API Docs (Swagger): http://localhost:${PORT}/api-docs`);
});

// Для Vercel (если понадобится в будущем)
export default app;
