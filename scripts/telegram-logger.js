const https = require('https');

class TelegramLogger {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  async sendMessage(text) {
    if (!this.botToken || !this.chatId) {
      console.log('Telegram logger not configured');
      return null;
    }

    const payload = {
      chat_id: this.chatId,
      text: text,
      parse_mode: 'Markdown'
    };

    try {
      const response = await this.makeRequest('sendMessage', payload);
      return response;
    } catch (error) {
      console.error('Telegram logger error:', error.message);
      return null;
    }
  }

  async sendError(title, error, context = '') {
    let message = '🚨 *' + title + '*\n\n';

    if (context) {
      message += '*Контекст:* ' + context + '\n';
    }

    message += '*Ошибка:* `' + error + '`\n';

    return this.sendMessage(message);
  }

  async sendSuccess(title, details = '', stats = {}) {
    let message = '✅ *' + title + '*\n\n';

    if (details) {
      message += details + '\n\n';
    }

    if (Object.keys(stats).length > 0) {
      message += '*Статистика:*\n';
      const statsLines = Object.entries(stats).map(([key, value]) => '• ' + key + ': ' + value);
      message += statsLines.join('\n') + '\n\n';
    }

    return this.sendMessage(message);
  }

  async makeRequest(method, payload) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (parsedData.ok) {
              resolve(parsedData);
            } else {
              reject(new Error(parsedData.description || 'Unknown error'));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  // Convenience methods for specific logging scenarios
  async logParsingStart() {
    return this.sendSuccess('🚀 Начало парсинга Telegram каналов', 'Запущен процесс сбора новых объявлений');
  }

  async logParsingResult(messageCount) {
    return this.sendSuccess('📡 Парсинг завершен', 'Собраны сообщения с каналов', {
      'Найдено сообщений': messageCount
    });
  }

  async logProcessingComplete() {
    return this.sendSuccess('🤖 Обработка завершена', 'Все сообщения обработаны через AI и сохранены в базу данных');
  }

  async logSuccess(duration, listingsCount = 0) {
    const stats = {
      'Время выполнения': duration + ' сек',
      'Создано объявлений': listingsCount,
      'Следующий запуск': 'через 30 минут'
    };

    return this.sendSuccess('✅ Полный цикл завершен', 'Парсинг и обработка выполнены успешно', stats);
  }

  async logError(error) {
    return this.sendError('❌ Ошибка парсинга', error);
  }
}

module.exports = TelegramLogger;