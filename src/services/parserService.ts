import fs from 'fs/promises';
import path from 'path';
import { supabase } from '../config/supabase';
import { TelegramMessage } from '../types';

export class ParserService {
  private parserDataPath = path.resolve(__dirname, '../../../telegram-parser/parsed_messages.json');

  async parseChannel(username: string): Promise<TelegramMessage[]> {
    // TODO: интеграция с telegram-parser
    // Пока возвращаем пустой массив
    return [];
  }

  async saveRawMessages(channelId: string, messages: TelegramMessage[]): Promise<any[]> {
    const savedMessages = [];
    for (const msg of messages) {
      // Проверка на существование
      const { data: existing } = await supabase
        .from('raw_messages')
        .select('id')
        .eq('channel_id', channelId)
        .eq('telegram_message_id', msg.id)
        .single();

      if (existing) {
        console.log(`⏭️  Сообщение ${msg.id} уже существует, пропускаем`);
        continue;
      }

      // Сохранение нового сообщения
      const { data: newMessage, error } = await supabase
        .from('raw_messages')
        .insert({
          channel_id: channelId,
          telegram_message_id: msg.id,
          raw_text: msg.text,
          author_info: {
            id: msg.author.id,
            username: msg.author.username,
            firstName: msg.author.firstName,
            lastName: msg.author.lastName,
            phone: msg.author.phone,
          },
          media_urls: msg.images,
          message_date: msg.date,
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Ошибка сохранения сообщения ${msg.id}:`, error);
      } else {
        console.log(`✅ Сохранено сообщение ${msg.id}`);
        savedMessages.push(newMessage);
      }
    }

    return savedMessages;
  }
}

export const parserService = new ParserService();
