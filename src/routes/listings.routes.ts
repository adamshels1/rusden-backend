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

// GET /api/listings - получить список объявлений
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

// GET /api/listings/:id - получить конкретное объявление
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
