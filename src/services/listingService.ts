import { supabase } from '../config/supabase';
import { AIService } from './aiService';
import { RawMessage } from '../types';

export class ListingService {
  private aiService = new AIService();

  async processRawMessage(rawMessageId: string): Promise<void> {
    // Получаем сырое сообщение
    const { data: rawMessage, error: fetchError } = await supabase
      .from('raw_messages')
      .select('*')
      .eq('id', rawMessageId)
      .single();

    if (fetchError || !rawMessage) {
      console.error(`❌ Ошибка получения сообщения ${rawMessageId}:`, fetchError);
      return;
    }

    try {
      // Обрабатываем через AI
      const aiResult = await this.aiService.categorizeMessage(rawMessage.raw_text);
      const correctedResult = this.applyCategoryHeuristics(rawMessage.raw_text, aiResult);

      // Сохраняем как listing
      await this.saveListing(rawMessageId, correctedResult, 'completed');

      console.log(`✅ Обработано сообщение ${rawMessageId} (категория: ${correctedResult.category})`);
    } catch (error) {
      console.error(`❌ Ошибка AI обработки ${rawMessageId}:`, error);
      await this.saveListing(rawMessageId, {}, 'failed');
    }
  }

  async processPendingMessages(limit = 10): Promise<void> {
    // Получаем ID сырых сообщений, которые еще не обработаны
    const { data: processedIds } = await supabase
      .from('listings')
      .select('raw_message_id');

    const processedIdsSet = new Set(processedIds?.map(l => l.raw_message_id) || []);

    const { data: rawMessages, error } = await supabase
      .from('raw_messages')
      .select('*')
      .order('posted_at', { ascending: false })
      .limit(limit * 2); // Берем с запасом

    if (error) {
      console.error('❌ Ошибка получения сырых сообщений:', error);
      return;
    }

    // Фильтруем необработанные
    const unprocessed = rawMessages?.filter(m => !processedIdsSet.has(m.id)).slice(0, limit) || [];

    if (unprocessed.length === 0) {
      console.log('ℹ️  Нет новых сообщений для обработки');
      return;
    }

    console.log(`📊 Обрабатываем ${unprocessed.length} сообщений...`);

    for (const rawMessage of unprocessed) {
      await this.processMessage(rawMessage);
    }
  }

  private async processMessage(rawMessage: RawMessage): Promise<void> {
    console.log(`\n🔄 Обработка сообщения ${rawMessage.telegram_message_id}...`);

    try {
      // AI категоризация
      const aiResult = await this.aiService.categorizeMessageWithRetry(rawMessage.raw_text);
      const correctedResult = this.applyCategoryHeuristics(rawMessage.raw_text, aiResult);

      // Пропускаем спам
      if (correctedResult.is_spam) {
        console.log('🚫 Сообщение помечено как спам, пропускаем');
        await this.saveListing(rawMessage.id, correctedResult, 'completed');
        return;
      }

      // Сохраняем в listings
      await this.saveListing(rawMessage.id, correctedResult, 'completed');
      console.log(`✅ Сообщение обработано успешно (категория: ${correctedResult.category})`);

    } catch (error: any) {
      console.error(`❌ Ошибка обработки сообщения ${rawMessage.telegram_message_id}:`, error.message);

      // Сохраняем с ошибкой
      await supabase.from('listings').insert({
        raw_message_id: rawMessage.id,
        category: 'event',
        ai_processing_status: 'failed',
        ai_error_message: error.message,
      });
    }
  }

  private async saveListing(
    rawMessageId: string,
    aiResult: any,
    status: 'completed' | 'failed'
  ): Promise<void> {
    const { error } = await supabase.from('listings').insert({
      raw_message_id: rawMessageId,
      category: aiResult.category || 'goods',
      subcategory: aiResult.subcategory,
      title: aiResult.title || 'Без названия',
      description: aiResult.description || '',
      price: aiResult.price_amount,
      currency: aiResult.price_currency,
      location: aiResult.city || aiResult.district,
      contact_info: {
        phone: aiResult.contact_phone,
        telegram: aiResult.contact_telegram,
      },
      posted_date: new Date().toISOString(),
      ai_confidence: aiResult.confidence || 0.5,
      ai_processing_status: status,
    });

    if (error) {
      console.error('❌ Ошибка сохранения в listings:', error);
      throw error;
    }
  }

  private applyCategoryHeuristics(rawText: string, aiResult: any) {
    const result = { ...aiResult };
    const text = (rawText || '').toLowerCase();

    if (!result.description && rawText) {
      result.description = rawText.trim();
    }

    const realtyPatterns = [
      /\bквартир/i,
      /\bапарт/i,
      /\bстудия/i,
      /\bжк\b/i,
      /\bжилой\s+комплекс/i,
      /\bжилкомплекс/i,
      /\bдом\b/i,
      /\bвилла/i,
      /\bдуплекс/i,
      /\bпентхаус/i,
      /residen[ct]/i,
    ];
    const autoPatterns = [
      /\bавто/i,
      /\bмашин/i,
      /\bcar\b/i,
      /\bавтомоб/i,
      /rent\s*a\s*car/i,
      /\bтранспорт/i,
    ];

    const hasPlanNotation = /\b\d+\s*\+\s*\d\b/.test(text);
    const hasRealtyKeyword = realtyPatterns.some(pattern => pattern.test(text));
    const hasAutoKeyword = autoPatterns.some(pattern => pattern.test(text));

    if ((hasRealtyKeyword || hasPlanNotation) && result.category !== 'realty') {
      result.category = 'realty';
    }

    if (result.category === 'auto' && !hasAutoKeyword && (hasRealtyKeyword || hasPlanNotation)) {
      result.category = 'realty';
    }

    if (result.category === 'realty') {
      const salePatterns = [/продам/i, /продаю/i, /продаж/i, /продается/i];
      const rentShortPatterns = [/краткосроч/i, /посут/i, /сутк/i, /daily/i, /на\s+недел/i, /на\s+ноч/i];
      const rentLongPatterns = [/долгосроч/i, /долгосрок/i, /на\s+год/i, /12\s*мес/i, /12\s*месяц/i];
      const rentWord = /аренд|сдам|сдаю/i.test(text);

      const currentSubcategory = typeof result.subcategory === 'string' ? result.subcategory.toLowerCase() : '';

      if (!currentSubcategory || currentSubcategory.includes('авто')) {
        if (salePatterns.some(pattern => pattern.test(text))) {
          result.subcategory = 'Продажа';
        } else if (rentShortPatterns.some(pattern => pattern.test(text))) {
          result.subcategory = 'Краткосрочная аренда';
        } else if (rentLongPatterns.some(pattern => pattern.test(text)) || rentWord) {
          result.subcategory = 'Аренда';
        }
      }

      if (!result.price_currency) {
        if (/eur|€|евро/i.test(text)) {
          result.price_currency = 'EUR';
        } else if (/usd|\$|доллар/i.test(text)) {
          result.price_currency = 'USD';
        } else if (/try|₺|лир|lira/i.test(text)) {
          result.price_currency = 'TRY';
        }
      }
    }

    return result;
  }

  async getListings(filters: {
    category?: string;
    subcategory?: string;
    city?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('posted_date', { ascending: false });

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.subcategory) {
      query = query.eq('subcategory', filters.subcategory);
    }

    if (filters.city) {
      query = query.ilike('location', `%${filters.city}%`);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.minPrice) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }

    const { data, error, count } = await query
      .limit(filters.limit || 20)
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

    if (error) {
      console.error('❌ Ошибка получения listings:', error);
      throw error;
    }

    // Преобразуем имена файлов в полные URL Supabase Storage (только если это не полный URL)
    const listingsWithImages = data?.map(listing => {
      if (listing.images && Array.isArray(listing.images)) {
        listing.images = listing.images.map((imageUrl: string) => {
          // Если это уже полный URL, возвращаем как есть
          if (imageUrl.startsWith('http')) {
            return imageUrl;
          }
          // Если это имя файла, формируем полный URL
          const { data } = supabase.storage
            .from('listings-images')
            .getPublicUrl(imageUrl);
          return data.publicUrl;
        });
      }
      return listing;
    });

    return { data: listingsWithImages, count };
  }
}

export const listingService = new ListingService();
