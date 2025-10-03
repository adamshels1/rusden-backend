import { groq } from '../config/groq';

interface AICategorizationResult {
  category: 'realty' | 'job' | 'service' | 'goods' | 'auto' | 'event';
  subcategory: string | null;
  title: string;
  price_amount: number | null;
  price_currency: 'EUR' | 'USD' | 'TRY' | null;
  price_period: 'month' | 'day' | 'once' | null;
  city: string | null;
  district: string | null;
  contact_phone: string | null;
  contact_telegram: string | null;
  language: 'ru' | 'en' | 'tr';
  is_spam: boolean;
  confidence: number; // 0.0 - 1.0

  // Для недвижимости
  realty_rooms: string | null;
  realty_area_sqm: number | null;
  realty_floor: number | null;
  realty_distance_to_sea: number | null;
}

export class AIService {
  private systemPrompt = `Ты - AI-ассистент для категоризации объявлений из Telegram-каналов русскоязычных экспатов в Турции.

Твоя задача:
1. Определить категорию объявления
2. Извлечь структурированные данные
3. Определить язык текста
4. Выявить спам

Категории:
- realty: недвижимость (аренда, продажа)
- job: вакансии - когда работодатель/компания ИЩЕТ сотрудника (требуется повар, нужен водитель)
- service: услуги - когда специалист ПРЕДЛАГАЕТ свои услуги (даю уроки, делаю ремонт, психолог, юрист)
- goods: товары (мебель, техника)
- auto: автомобили, транспорт
- event: мероприятия, встречи, информационные сообщения

Подкатегории для realty:
- rent_long: долгосрочная аренда
- rent_short: краткосрочная аренда
- sale: продажа
- roommate: поиск соседа

Города Турции: Istanbul, Antalya, Alanya, Bodrum, Marmaris, Izmir, Ankara

ВАЖНО:
- Если в тексте нет явной цены, ставь null
- Номера телефонов могут быть в международном формате
- Telegram username начинается с @
- Расстояние до моря обычно указано в метрах (например "500 метров до моря")
- Планировки квартир в формате "1+1", "2+1" (комнаты + гостиная)

Отвечай ТОЛЬКО в JSON формате без дополнительного текста.`;

  async categorizeMessage(text: string): Promise<AICategorizationResult> {
    const userPrompt = `Категоризируй следующее объявление:

${text}

Верни результат в JSON формате:
{
  "category": "realty|job|service|goods|auto|event",
  "subcategory": "string или null",
  "title": "краткое описание объявления (до 100 символов)",
  "price_amount": number или null,
  "price_currency": "EUR|USD|TRY|null",
  "price_period": "month|day|once|null",
  "city": "string или null",
  "district": "string или null",
  "contact_phone": "string или null",
  "contact_telegram": "string или null (без @)",
  "language": "ru|en|tr",
  "is_spam": boolean,
  "confidence": number (0.0-1.0),
  "realty_rooms": "string или null (например 1+1)",
  "realty_area_sqm": number или null,
  "realty_floor": number или null,
  "realty_distance_to_sea": number или null (в метрах)
}`;

    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Бесплатная модель Groq
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3, // низкая температура для более стабильных результатов
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0].message.content || '{}');
      return result as AICategorizationResult;
    } catch (error) {
      console.error('❌ Ошибка AI категоризации:', error);
      throw error;
    }
  }

  async categorizeMessageWithRetry(text: string, maxRetries = 3): Promise<AICategorizationResult> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.categorizeMessage(text);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        console.log(`⚠️  Попытка ${i + 1} не удалась, повторяем...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // exponential backoff
      }
    }
    throw new Error('Failed after max retries');
  }
}
