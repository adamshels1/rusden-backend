import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rusden API - Telegram Ads Aggregator',
      version: '1.0.0',
      description: `
# Rusden API

Публичный API для агрегатора объявлений из Telegram каналов для русскоязычных экспатов в Турции.

## Возможности
- Поиск объявлений по категориям (недвижимость, работа, услуги, товары, события)
- Фильтрация по городу и цене
- AI-категоризация с помощью Groq LLM
- Бесплатный публичный доступ (только GET запросы)

## Категории объявлений
- **realty** - недвижимость (аренда, продажа)
- **job** - работа и вакансии
- **service** - услуги (юристы, врачи, мастера)
- **goods** - товары (мебель, техника, авто)
- **event** - мероприятия и встречи

## Города Турции
Istanbul, Antalya, Alanya, Bodrum, Marmaris, Izmir, Ankara, Side, Kemer, Belek

## Технологии
- **Backend**: Node.js + Express + TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq llama-3.3-70b-versatile
- **Hosting**: Vercel
      `,
      contact: {
        name: 'Rusden Support',
        url: 'https://github.com/rusden',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: env.NODE_ENV === 'production'
          ? 'https://rusden.vercel.app'
          : `http://localhost:${env.PORT}`,
        description: env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    tags: [
      {
        name: 'Listings',
        description: 'Операции с объявлениями',
      },
      {
        name: 'Health',
        description: 'Проверка состояния сервера',
      },
    ],
    components: {
      schemas: {
        Listing: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Уникальный идентификатор объявления',
            },
            raw_message_id: {
              type: 'string',
              format: 'uuid',
              description: 'ID исходного сообщения из Telegram',
            },
            category: {
              type: 'string',
              enum: ['realty', 'job', 'service', 'goods', 'event'],
              description: 'Категория объявления',
            },
            title: {
              type: 'string',
              description: 'Заголовок объявления',
              example: 'Сдается квартира 2+1 в Алании',
            },
            description: {
              type: 'string',
              description: 'Описание объявления',
              example: 'Квартира 2+1, 100м2, 5 этаж, 200м до моря',
            },
            price: {
              type: 'number',
              nullable: true,
              description: 'Цена',
              example: 25000,
            },
            currency: {
              type: 'string',
              nullable: true,
              enum: ['TRY', 'USD', 'EUR'],
              description: 'Валюта',
              example: 'TRY',
            },
            location: {
              type: 'string',
              nullable: true,
              description: 'Город или район',
              example: 'Alanya, Mahmutlar',
            },
            contact_info: {
              type: 'object',
              nullable: true,
              properties: {
                phone: { type: 'string', example: '+90 555 123 4567' },
                telegram: { type: 'string', example: '@username' },
              },
              description: 'Контактная информация',
            },
            images: {
              type: 'array',
              nullable: true,
              items: { type: 'string' },
              description: 'Массив URL изображений',
            },
            posted_date: {
              type: 'string',
              format: 'date-time',
              description: 'Дата публикации',
            },
            expires_at: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Дата истечения',
            },
            is_active: {
              type: 'boolean',
              description: 'Активно ли объявление',
            },
            ai_confidence: {
              type: 'number',
              nullable: true,
              minimum: 0,
              maximum: 1,
              description: 'Уверенность AI в категоризации (0-1)',
              example: 0.9,
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания записи',
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Дата последнего обновления',
            },
          },
        },
        ListingsResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Статус запроса',
            },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Listing' },
            },
            meta: {
              type: 'object',
              properties: {
                limit: { type: 'number', example: 20 },
                offset: { type: 'number', example: 0 },
              },
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
            details: {
              type: 'object',
              nullable: true,
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/app.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
