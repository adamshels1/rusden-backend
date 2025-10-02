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

      // Сохраняем как listing
      await this.saveListing(rawMessageId, aiResult, 'completed');

      console.log(`✅ Обработано сообщение ${rawMessageId}`);
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

      // Пропускаем спам
      if (aiResult.is_spam) {
        console.log('🚫 Сообщение помечено как спам, пропускаем');
        await this.saveListing(rawMessage.id, aiResult, 'completed');
        return;
      }

      // Сохраняем в listings
      await this.saveListing(rawMessage.id, aiResult, 'completed');
      console.log(`✅ Сообщение обработано успешно (категория: ${aiResult.category})`);

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
    });

    if (error) {
      console.error('❌ Ошибка сохранения в listings:', error);
      throw error;
    }
  }

  async getListings(filters: {
    category?: string;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('listings')
      .select('*')
      .eq('is_active', true)
      .order('posted_date', { ascending: false });

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.city) {
      query = query.ilike('location', `%${filters.city}%`);
    }

    if (filters.minPrice) {
      query = query.gte('price', filters.minPrice);
    }

    if (filters.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }

    const { data, error } = await query
      .limit(filters.limit || 20)
      .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20) - 1);

    if (error) {
      console.error('❌ Ошибка получения listings:', error);
      throw error;
    }

    return data;
  }
}

export const listingService = new ListingService();
