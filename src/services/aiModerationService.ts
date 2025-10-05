import Groq from 'groq-sdk';
import { env } from '../config/env';

const groq = new Groq({ apiKey: env.GROQ_API_KEY });

const MODERATION_PROMPT = `Ты — AI-модератор для проверки объявлений от пользователей.

Твоя задача: проверить объявление на:
1. Спам и нежелательный контент (бары, клубы, стриптиз, ночные клубы, массаж, эскорт, интим, хостес, танцовщицы)
2. Соответствие категории и описания
3. Адекватность контактной информации

**Категории:**
- realty: недвижимость (квартиры, дома, виллы, студии, комнаты)
- job: вакансии (работодатель ищет сотрудника)
- service: услуги (специалист предлагает услуги)
- goods: товары (мебель, техника, одежда)
- auto: автомобили и транспорт

**ВАЖНО:**
- Если есть признаки спама/нежелательного контента - ОТКЛОНИТЬ
- Если контакты выглядят подозрительно - ОТКЛОНИТЬ
- Если описание полностью бессмысленное (случайный набор букв) - ОТКЛОНИТЬ
- НЕ проверяй длину описания - это уже проверено

Отвечай ТОЛЬКО в JSON формате:
{
  "approved": true | false,
  "reason": "причина отклонения если approved=false, иначе null",
  "category": "предложенная категория",
  "subcategory": "предложенная подкатегория",
  "confidence": 0.0-1.0
}`;

interface ModerationInput {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  phone?: string;
  telegram?: string;
  location?: string;
}

interface ModerationResult {
  approved: boolean;
  reason: string | null;
  category: string;
  subcategory?: string;
  confidence: number;
}

export class AIModerationService {
  async moderateListing(input: ModerationInput): Promise<ModerationResult> {
    const userPrompt = `
Проверь это объявление:

Заголовок: ${input.title}
Описание: ${input.description}
Категория: ${input.category}
${input.subcategory ? `Подкатегория: ${input.subcategory}` : ''}
${input.location ? `Местоположение: ${input.location}` : ''}

Контакты:
${input.phone ? `Телефон: ${input.phone}` : ''}
${input.telegram ? `Telegram: ${input.telegram}` : ''}
${!input.phone && !input.telegram ? 'Контакты отсутствуют' : ''}
`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: MODERATION_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return {
      approved: result.approved,
      reason: result.reason,
      category: result.category,
      subcategory: result.subcategory,
      confidence: result.confidence,
    };
  }

  // Дополнительная валидация на уровне кода
  validateBasicRules(input: ModerationInput): { valid: boolean; reason?: string } {
    // Проверка контактов
    if (!input.phone && !input.telegram) {
      return { valid: false, reason: 'Необходимо указать хотя бы один контакт (телефон или Telegram)' };
    }

    // Проверка длины описания (убираем только лишние пробелы, но не переносы строк)
    const cleanDescription = input.description?.replace(/\s+/g, ' ').trim() || '';
    console.log('📝 Description validation:');
    console.log('  Original:', input.description);
    console.log('  Clean:', cleanDescription);
    console.log('  Length:', cleanDescription.length);

    if (cleanDescription.length < 10) {
      return { valid: false, reason: 'Описание слишком короткое (минимум 10 символов)' };
    }

    // Проверка заголовка
    const cleanTitle = input.title?.trim() || '';
    if (cleanTitle.length < 5) {
      return { valid: false, reason: 'Заголовок слишком короткий (минимум 5 символов)' };
    }

    // Проверка на запрещенные слова
    const spamKeywords = /бар|клуб|стрип|ночной|массаж|эскорт|интим|девушк[иа]\s+для|хостес|танцовщиц/i;
    const textToCheck = `${input.title} ${input.description}`;

    if (spamKeywords.test(textToCheck)) {
      return { valid: false, reason: 'Объявление содержит запрещенный контент' };
    }

    return { valid: true };
  }
}
