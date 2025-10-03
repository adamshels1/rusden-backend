import { Router } from 'express';
import { ListingService } from '../services/listingService';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();
const listingService = new ListingService();

// Схема валидации фильтров
const listingsQuerySchema = z.object({
  category: z.enum(['realty', 'job', 'service', 'goods', 'event']).optional(),
  city: z.string().optional(),
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
    const listings = await listingService.getListings(filters);

    res.json({
      success: true,
      data: listings,
      meta: {
        limit: filters.limit,
        offset: filters.offset,
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

export default router;
