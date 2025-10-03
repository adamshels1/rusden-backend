require('dotenv').config();
const MTProto = require('@mtproto/core');
const path = require('path');

const api_id = parseInt(process.env.API_ID);
const api_hash = process.env.API_HASH;

const mtproto = new MTProto({
  api_id,
  api_hash,
  storageOptions: {
    path: path.resolve(__dirname, './data.json'),
  },
  customLocalStorage: {},
});

const phone = '+905525974578';
const code = '42587'; // КОД ИЗ TELEGRAM

async function sendCode(phone) {
  try {
    const { phone_code_hash } = await mtproto.call('auth.sendCode', {
      phone_number: phone,
      settings: {
        _: 'codeSettings',
      },
    });
    return phone_code_hash;
  } catch (error) {
    if (error.error_message && error.error_message.includes('PHONE_MIGRATE_')) {
      const [, dc] = error.error_message.match(/PHONE_MIGRATE_(\d+)/);
      await mtproto.setDefaultDc(+dc);
      return sendCode(phone);
    }
    throw error;
  }
}

async function signIn({ code, phone, phone_code_hash }) {
  try {
    const signInResult = await mtproto.call('auth.signIn', {
      phone_code: code,
      phone_number: phone,
      phone_code_hash: phone_code_hash,
    });
    return signInResult;
  } catch (error) {
    if (error.error_message === 'SESSION_PASSWORD_NEEDED') {
      console.error('❌ Требуется пароль 2FA! Добавьте его в скрипт.');
      throw error;
    }
    throw error;
  }
}

(async () => {
  console.log('\n=== Авторизация с кодом ===\n');

  console.log(`📱 Вход с номером: ${phone}`);
  console.log(`🔢 Используем код: ${code}\n`);

  const phone_code_hash = await sendCode(phone);

  const result = await signIn({
    code,
    phone,
    phone_code_hash,
  });

  console.log('✅ Авторизация успешна!');
  console.log(`👤 Пользователь: ${result.user.first_name}`);
  console.log('\n📝 Сессия сохранена в data.json');
  console.log('\nТеперь можно запускать: node simple-parser.js\n');
})().catch(error => {
  console.error('\n❌ Ошибка:', error.error_message || error.message);

  if (error.error_message === 'PHONE_CODE_EXPIRED') {
    console.log('\n⚠️  Код устарел! Получите новый код и обновите переменную code в скрипте.\n');
  }
});
