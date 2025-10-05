import { Router } from 'express';
import { ListingService } from '../services/listingService';
import { AIModerationService } from '../services/aiModerationService';
import { supabase } from '../config/supabase';
import { z } from 'zod';
import multer from 'multer';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

const router = Router();
const listingService = new ListingService();
const moderationService = new AIModerationService();

// Настройка multer для загрузки в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB максимум
    files: 4, // максимум 4 файла
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  },
});

// Схема валидации фильтров
const listingsQuerySchema = z.object({
  category: z.enum(['realty', 'job', 'service', 'goods', 'auto', 'event']).optional(),
  subcategory: z.string().optional(),
  location: z.string().optional(),
  city: z.string().optional(), // для обратной совместимости
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * @openapi
 * /api/listings/categories:
 *   get:
 *     tags:
 *       - Listings
 *     summary: Получить список категорий
 *     description: Возвращает список всех доступных категорий объявлений
 *     responses:
 *       200:
 *         description: Список категорий
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       label:
 *                         type: string
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { name: 'realty', label: 'Недвижимость' },
      { name: 'job', label: 'Работа' },
      { name: 'service', label: 'Услуги' },
      { name: 'goods', label: 'Товары' },
      { name: 'event', label: 'События' },
    ];

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * @openapi
 * /api/listings/subcategories:
 *   get:
 *     tags:
 *       - Listings
 *     summary: Получить список подкатегорий
 *     description: Возвращает список всех уникальных подкатегорий из объявлений
 *     parameters:
 *       - name: category
 *         in: query
 *         description: Фильтр по категории
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Список подкатегорий
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/subcategories', async (req, res) => {
  try {
    let query = supabase
      .from('listings')
      .select('subcategory')
      .not('subcategory', 'is', null);

    if (req.query.category) {
      query = query.eq('category', req.query.category);
    }

    const { data, error } = await query;

    if (error) throw error;

    const subcategories = [...new Set(
      data
        .map((item: any) => item.subcategory)
        .filter(Boolean)
    )].sort();

    res.json({
      success: true,
      data: subcategories,
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * @openapi
 * /api/listings/cities:
 *   get:
 *     tags:
 *       - Listings
 *     summary: Получить список городов
 *     description: Возвращает список всех уникальных городов из объявлений
 *     responses:
 *       200:
 *         description: Список городов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/cities', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('location')
      .not('location', 'is', null);

    if (error) throw error;

    // Извлекаем уникальные города
    const cities = [...new Set(
      data
        .map((item: any) => item.location)
        .filter(Boolean)
        .map((loc: string) => loc.split(',')[0].trim()) // Берем только город (до запятой)
    )].sort();

    res.json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * @openapi
 * /api/listings:
 *   get:
 *     tags:
 *       - Listings
 *     summary: Получить список объявлений
 *     description: Возвращает список объявлений с возможностью фильтрации по категории, городу и цене
 *     parameters:
 *       - name: category
 *         in: query
 *         description: Категория объявления
 *         schema:
 *           type: string
 *           enum: [realty, job, service, goods, event]
 *         example: realty
 *       - name: city
 *         in: query
 *         description: Город (поиск по подстроке)
 *         schema:
 *           type: string
 *         example: Alanya
 *       - name: minPrice
 *         in: query
 *         description: Минимальная цена
 *         schema:
 *           type: number
 *         example: 10000
 *       - name: maxPrice
 *         in: query
 *         description: Максимальная цена
 *         schema:
 *           type: number
 *         example: 50000
 *       - name: limit
 *         in: query
 *         description: Количество результатов (максимум 100)
 *         schema:
 *           type: number
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *       - name: offset
 *         in: query
 *         description: Смещение для пагинации
 *         schema:
 *           type: number
 *           default: 0
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Список объявлений
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListingsResponse'
 *       400:
 *         description: Неверные параметры запроса
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/', async (req, res) => {
  try {
    const filters = listingsQuerySchema.parse(req.query);

    // Поддержка как location, так и city параметров
    const cityFilter = filters.location || filters.city;

    const { data, count } = await listingService.getListings({
      ...filters,
      city: cityFilter,
    });

    res.json({
      success: true,
      data,
      meta: {
        limit: filters.limit,
        offset: filters.offset,
        total: count,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.issues,
      });
    }

    console.error('Error fetching listings:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * @openapi
 * /api/listings/{id}:
 *   get:
 *     tags:
 *       - Listings
 *     summary: Получить объявление по ID
 *     description: Возвращает одно объявление с полной информацией
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: UUID объявления
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Объявление найдено
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Listing'
 *       404:
 *         description: Объявление не найдено
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('listings')
      .select('*, raw_messages(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Listing not found',
      });
    }

    // Преобразуем имена файлов в полные URL Supabase Storage (только если это не полный URL)
    if (data.images && Array.isArray(data.images)) {
      data.images = data.images.map((imageUrl: string) => {
        // Если это уже полный URL, возвращаем как есть
        if (imageUrl.startsWith('http')) {
          return imageUrl;
        }
        // Если это имя файла, формируем полный URL
        const { data: urlData } = supabase.storage
          .from('listings-images')
          .getPublicUrl(imageUrl);
        return urlData.publicUrl;
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching listing:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// Схема валидации для создания объявления
const createListingSchema = z.object({
  title: z.string().min(5, 'Заголовок должен содержать минимум 5 символов'),
  description: z.string().min(10, 'Описание должно содержать минимум 10 символов'),
  category: z.enum(['realty', 'job', 'service', 'goods', 'auto']),
  subcategory: z.string().optional(),
  price: z.number().optional(),
  currency: z.enum(['EUR', 'USD', 'TRY']).optional(),
  location: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_telegram: z.string().optional(),
});

/**
 * @openapi
 * /api/listings:
 *   post:
 *     tags:
 *       - Listings
 *     summary: Создать новое объявление
 *     description: Создает новое объявление с AI модерацией
 */
router.post('/', upload.array('images', 4), async (req, res) => {
  try {
    console.log('📥 Received POST request');
    console.log('Body:', req.body);
    console.log('Files:', req.files?.length || 0);

    // Валидация данных
    const listingData = createListingSchema.parse(JSON.parse(req.body.data || '{}'));

    // Базовая валидация
    const basicValidation = moderationService.validateBasicRules({
      title: listingData.title,
      description: listingData.description,
      category: listingData.category,
      subcategory: listingData.subcategory,
      phone: listingData.contact_phone,
      telegram: listingData.contact_telegram,
      location: listingData.location,
    });

    if (!basicValidation.valid) {
      console.log('❌ Basic validation failed:', basicValidation.reason);
      return res.status(400).json({
        success: false,
        error: basicValidation.reason,
      });
    }

    console.log('✅ Basic validation passed');

    // AI модерация
    console.log('🤖 Starting AI moderation...');
    const moderation = await moderationService.moderateListing({
      title: listingData.title,
      description: listingData.description,
      category: listingData.category,
      subcategory: listingData.subcategory,
      phone: listingData.contact_phone,
      telegram: listingData.contact_telegram,
      location: listingData.location,
    });

    console.log('🤖 AI moderation result:', moderation);

    if (!moderation.approved) {
      console.log('❌ AI moderation failed:', moderation.reason);
      return res.status(400).json({
        success: false,
        error: moderation.reason || 'Объявление не прошло модерацию',
      });
    }

    console.log('✅ AI moderation passed');

    // Исправляем возможные опечатки AI в категории
    const categoryMap: Record<string, string> = {
      'reality': 'realty',
      'realty': 'realty',
      'job': 'job',
      'service': 'service',
      'goods': 'goods',
      'auto': 'auto',
    };
    const finalCategory = categoryMap[moderation.category.toLowerCase()] || moderation.category;

    // Обработка и загрузка изображений
    const imageUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        try {
          // Сжатие изображения
          const compressedBuffer = await sharp(file.buffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          // Генерация уникального имени файла
          const filename = `${randomUUID()}.jpg`;

          // Загрузка в Supabase Storage
          const { data, error } = await supabase.storage
            .from('listings-images')
            .upload(filename, compressedBuffer, {
              contentType: 'image/jpeg',
              cacheControl: '3600',
            });

          if (error) {
            console.error('Error uploading image:', error);
            continue;
          }

          // Получение публичного URL
          const { data: urlData } = supabase.storage
            .from('listings-images')
            .getPublicUrl(filename);

          imageUrls.push(urlData.publicUrl);
        } catch (imgError) {
          console.error('Error processing image:', imgError);
        }
      }
    }

    // Создание объявления
    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        category: finalCategory,
        subcategory: moderation.subcategory,
        title: listingData.title,
        description: listingData.description,
        price: listingData.price,
        currency: listingData.currency,
        location: listingData.location,
        contact_info: {
          phone: listingData.contact_phone,
          telegram: listingData.contact_telegram?.replace(/^@/, ''),
        },
        images: imageUrls,
        posted_date: new Date().toISOString(),
        ai_confidence: moderation.confidence,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating listing:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Ошибка при создании объявления',
      });
    }

    res.status(201).json({
      success: true,
      data: listing,
      message: 'Объявление успешно создано и прошло модерацию',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Некорректные данные',
        details: error.issues,
      });
    }

    console.error('Error creating listing:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
});

export default router;
