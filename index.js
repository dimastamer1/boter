const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf('7523881725:AAFRjNltWDXco--Pd2N93WqfZQhSwpuFdnM');
const API_TOKEN = 'jihhwop0pr8i763ojjhjjp990';

// Увеличиваем таймауты для бота
bot.telegram.options.agent = null;
bot.telegram.options.apiMode = 'bot';
bot.telegram.options.webhookReply = false;
bot.telegram.options.handlerTimeout = 600000; // 10 минут

// Хранилища данных
const mediaGroups = new Map();
const userLastPhotos = new Map();
const userSettings = new Map();
const userStates = new Map();
const userTokens = new Map();

// Папка для ассетов
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
  fs.mkdirSync(path.join(assetsDir, 'smileys'));
  fs.mkdirSync(path.join(assetsDir, 'textures'));
  console.log('Создана папка assets. Добавьте туда изображения для смайликов и текстур.');
}

// Загрузка смайликов и текстур
const loadAssets = () => {
  const smileys = [];
  const textures = [];
  
  const smileysDir = path.join(assetsDir, 'smileys');
  if (fs.existsSync(smileysDir)) {
    fs.readdirSync(smileysDir).forEach(file => {
      if (file.match(/\.(jpg|jpeg|png)$/)) {
        smileys.push(path.join(smileysDir, file));
      }
    });
  }
  
  const texturesDir = path.join(assetsDir, 'textures');
  if (fs.existsSync(texturesDir)) {
    fs.readdirSync(texturesDir).forEach(file => {
      if (file.match(/\.(jpg|jpeg|png)$/)) {
        textures.push(path.join(texturesDir, file));
      }
    });
  }
  
  return { smileys, textures };
};

const { smileys, textures } = loadAssets();
console.log(`Загружено ${smileys.length} смайликов и ${textures.length} текстур`);

// Генерация фонов
const generateBackground = async (type = 'random') => {
  try {
    let url;
    switch(type) {
      case 'colorful':
        url = 'https://picsum.photos/720/1280';
        break;
      case 'grayscale':
        url = 'https://picsum.photos/720/1280?grayscale';
        break;
      case 'blur':
        url = 'https://picsum.photos/720/1280?blur=5';
        break;
      default:
        url = Math.random() > 0.5 ? 
          'https://picsum.photos/720/1280' : 
          'https://picsum.photos/720/1280?grayscale';
    }
    
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    // Fallback background
    const colors = [
      '#222222', '#3a0ca3', '#f72585', '#4cc9f0', '#2b2d42',
      '#ff9e00', '#8338ec', '#3a86ff', '#ff006e', '#fb5607'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const img = new Jimp(720, 1280, color);
    return await img.getBufferAsync(Jimp.MIME_JPEG);
  }
};

// Эффекты для изображений
const effects = {
  async addNoise(image, intensity = 500) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;

    for (let i = 0; i < intensity; i++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      const color = Jimp.rgbaToInt(
        Math.floor(Math.random() * 30),
        Math.floor(Math.random() * 30),
        Math.floor(Math.random() * 30),
        60
      );
      image.setPixelColor(color, x, y);
    }
    return image;
  },

  async addSmileys(image, count = 3) {
    if (smileys.length === 0) return image;
    
    for (let i = 0; i < count; i++) {
      try {
        const smileyPath = smileys[Math.floor(Math.random() * smileys.length)];
        const smiley = await Jimp.read(smileyPath);
        const size = Math.floor(Math.random() * 50) + 20;
        smiley.resize(size, size);
        const x = Math.floor(Math.random() * (image.bitmap.width - size));
        const y = Math.floor(Math.random() * (image.bitmap.height - size));
        smiley.opacity(Math.random() * 0.5 + 0.3);
        image.composite(smiley, x, y);
      } catch (e) {
        console.error('Ошибка добавления смайлика:', e);
      }
    }
    return image;
  },

  async addTexture(image, opacity = 0.3) {
    if (textures.length === 0) return image;
    
    try {
      const texturePath = textures[Math.floor(Math.random() * textures.length)];
      const texture = await Jimp.read(texturePath);
      texture.resize(image.bitmap.width, image.bitmap.height);
      texture.opacity(opacity);
      image.composite(texture, 0, 0);
    } catch (e) {
      console.error('Ошибка добавления текстуры:', e);
    }
    return image;
  },

  async addVignette(image, intensity = 0.7) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const darkness = (dist / maxDist) * intensity;
        
        const color = image.getPixelColor(x, y);
        const rgba = Jimp.intToRGBA(color);
        
        const r = Math.max(0, rgba.r * (1 - darkness));
        const g = Math.max(0, rgba.g * (1 - darkness));
        const b = Math.max(0, rgba.b * (1 - darkness));
        
        image.setPixelColor(Jimp.rgbaToInt(r, g, b, rgba.a), x, y);
      }
    }
    return image;
  },

  async addLightLeak(image, intensity = 0.5) {
    if (textures.length === 0) return image;
    
    try {
      const leakPath = textures[Math.floor(Math.random() * textures.length)];
      const leak = await Jimp.read(leakPath);
      leak.resize(image.bitmap.width, image.bitmap.height);
      leak.opacity(intensity);
      leak.color([{ apply: 'lighten', params: [50] }]);
      image.composite(leak, 0, 0, {
        mode: Jimp.BLEND_LIGHTEN
      });
    } catch (e) {
      console.error('Ошибка добавления light leak:', e);
    }
    return image;
  },

  async addGrain(image, intensity = 0.3) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (Math.random() > intensity) continue;
        
        const color = image.getPixelColor(x, y);
        const rgba = Jimp.intToRGBA(color);
        
        const grain = Math.floor(Math.random() * 60) - 30;
        const r = Math.max(0, Math.min(255, rgba.r + grain));
        const g = Math.max(0, Math.min(255, rgba.g + grain));
        const b = Math.max(0, Math.min(255, rgba.b + grain));
        
        image.setPixelColor(Jimp.rgbaToInt(r, g, b, rgba.a), x, y);
      }
    }
    return image;
  },

  async addGlow(image, intensity = 0.3) {
    const clone = image.clone();
    clone.blur(10);
    clone.opacity(intensity);
    image.composite(clone, 0, 0, {
      mode: Jimp.BLEND_SOFT_LIGHT
    });
    return image;
  },

  async applyColorFilter(image, filter = 'sepia') {
    switch(filter) {
      case 'sepia':
        image.sepia();
        break;
      case 'vintage':
        image.color([{ apply: 'mix', params: ['#704214', 30] }]);
        break;
      case 'cool':
        image.color([{ apply: 'mix', params: ['#1e90ff', 10] }]);
        break;
      case 'warm':
        image.color([{ apply: 'mix', params: ['#ff4500', 10] }]);
        break;
    }
    return image;
  },

  async addScratches(image, intensity = 0.1) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    for (let i = 0; i < Math.floor(w * h * intensity); i++) {
      const x = Math.floor(Math.random() * w);
      const y = Math.floor(Math.random() * h);
      const length = Math.floor(Math.random() * 20) + 5;
      const color = Jimp.rgbaToInt(255, 255, 255, 50);
      
      for (let j = 0; j < length; j++) {
        if (x + j >= w) break;
        image.setPixelColor(color, x + j, y);
      }
    }
    return image;
  }
};

// Обработка изображения
async function processImage(userId, buffer, intensity = 3) {
  const settings = userSettings.get(userId) || getDefaultSettings();
  const filters = ['sepia', 'vintage', 'cool', 'warm'];
  
  let bgImage = await Jimp.read(await generateBackground(
    settings.colorfulBackground ? 'colorful' : 'random'
  ));
  
  if (settings.blurBackground) {
    bgImage.blur(10);
  }
  
  await effects.addNoise(bgImage, settings.noiseIntensity * intensity / 3);
  
  if (settings.addTexture) {
    await effects.addTexture(bgImage, 0.2 * intensity / 3);
  }
  
  if (settings.addVignette) {
    await effects.addVignette(bgImage, 0.7 * intensity / 3);
  }

  let mainImage = await Jimp.read(buffer);
  const maxWidth = bgImage.bitmap.width * 0.7;
  const maxHeight = bgImage.bitmap.height * 0.7;
  const scale = Math.min(maxWidth / mainImage.bitmap.width, maxHeight / mainImage.bitmap.height, 1);
  mainImage.resize(mainImage.bitmap.width * scale, mainImage.bitmap.height * scale);
  
  if (settings.blurMainImage) {
    mainImage.blur(1 * intensity / 3);
  }
  
  if (settings.addGrain) {
    await effects.addGrain(mainImage, 0.3 * intensity / 3);
  }

  const offsetX = Math.floor(Math.random() * 31) - 15;
  const offsetY = Math.floor(Math.random() * 31) - 15;
  const x = Math.floor((bgImage.bitmap.width - mainImage.bitmap.width) / 2) + offsetX;
  const y = Math.floor((bgImage.bitmap.height - mainImage.bitmap.height) / 2) + offsetY;

  bgImage.composite(mainImage, x, y);

  // Применяем эффекты несколько раз для большей уникальности
  for (let i = 0; i < intensity; i++) {
    if (settings.addSmileys && smileys.length > 0) {
      await effects.addSmileys(bgImage, settings.smileyCount * intensity / 3);
    }
    
    if (settings.addLightLeak) {
      await effects.addLightLeak(bgImage, 0.4 * intensity / 3);
    }
    
    if (settings.addGlow) {
      await effects.addGlow(bgImage, 0.2 * intensity / 3);
    }
    
    if (settings.addScratches) {
      await effects.addScratches(bgImage, 0.05 * intensity / 3);
    }
    
    if (settings.colorFilter && Math.random() > 0.5) {
      await effects.applyColorFilter(bgImage, filters[Math.floor(Math.random() * filters.length)]);
    }
  }

  const outPath = path.join(__dirname, `out_${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
  await bgImage.quality(90).writeAsync(outPath);
  return outPath;
}

function getDefaultSettings() {
  return {
    blurBackground: true,
    noiseIntensity: 1000,
    addSmileys: true,
    smileyCount: 3,
    blurMainImage: false,
    addTexture: true,
    addVignette: true,
    addLightLeak: false,
    addGrain: true,
    addGlow: false,
    addScratches: false,
    colorFilter: false,
    colorfulBackground: true,
    hasToken: false,
    intensity: 3 // Средняя мощность по умолчанию
  };
}

// Меню и клавиатуры
function getMainMenu(userId) {
  const settings = userSettings.get(userId) || getDefaultSettings();
  
  if (!settings.hasToken) {
    return null;
  }
  
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✨ Уникализировать', 'process'),
      Markup.button.callback('⚙️ Настройки', 'settings')
    ],
    [
      Markup.button.callback('ℹ️ Помощь', 'help'),
      Markup.button.callback('💎 Премиум', 'premium')
    ]
  ]);
}

function getSettingsMenu(userId) {
  const settings = userSettings.get(userId) || getDefaultSettings();
  
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`🌫 Размытие фона: ${settings.blurBackground ? '✅' : '❌'}`, 'toggle_blur_bg'),
      Markup.button.callback(`🖼 Размытие фото: ${settings.blurMainImage ? '✅' : '❌'}`, 'toggle_blur_main')
    ],
    [
      Markup.button.callback(`😊 Смайлики: ${settings.addSmileys ? '✅' : '❌'}`, 'toggle_smileys'),
      Markup.button.callback(`🧶 Текстуры: ${settings.addTexture ? '✅' : '❌'}`, 'toggle_texture')
    ],
    [
      Markup.button.callback(`🌘 Виньетка: ${settings.addVignette ? '✅' : '❌'}`, 'toggle_vignette'),
      Markup.button.callback(`🌞 Light leak: ${settings.addLightLeak ? '✅' : '❌'}`, 'toggle_lightleak')
    ],
    [
      Markup.button.callback(`✨ Свечение: ${settings.addGlow ? '✅' : '❌'}`, 'toggle_glow'),
      Markup.button.callback(`🎞 Grain: ${settings.addGrain ? '✅' : '❌'}`, 'toggle_grain')
    ],
    [
      Markup.button.callback(`✂️ Царапины: ${settings.addScratches ? '✅' : '❌'}`, 'toggle_scratches'),
      Markup.button.callback(`🌈 Фильтры: ${settings.colorFilter ? '✅' : '❌'}`, 'toggle_color_filter')
    ],
    [
      Markup.button.callback(`🎨 Цветной фон: ${settings.colorfulBackground ? '✅' : '❌'}`, 'toggle_colorful_bg'),
      Markup.button.callback(`💪 Мощность: ${getIntensityName(settings.intensity)}`, 'set_intensity')
    ],
    [
      Markup.button.callback('🔙 Назад', 'back_to_main')
    ]
  ]);
}

function getIntensityName(intensity) {
  const names = {
    1: '😊 Слабо',
    2: '😃 Легко',
    3: '😎 Нормально',
    4: '💪 Сильно',
    5: '🔥 Очень сильно',
    6: '🚀 Нереально'
  };
  return names[intensity] || intensity;
}

function getIntensityMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('😊 Слабо', 'intensity_1')],
    [Markup.button.callback('😃 Легко', 'intensity_2')],
    [Markup.button.callback('😎 Нормально', 'intensity_3')],
    [Markup.button.callback('💪 Сильно', 'intensity_4')],
    [Markup.button.callback('🔥 Очень сильно', 'intensity_5')],
    [Markup.button.callback('🚀 Нереально', 'intensity_6')],
    [Markup.button.callback('🔙 Назад', 'back_to_settings')]
  ]);
}

function getProcessMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('1 раз 😊', 'process_1')],
    [Markup.button.callback('2 раза 😃', 'process_2')],
    [Markup.button.callback('3 раза 😎', 'process_3')],
    [Markup.button.callback('🔙 Назад', 'back_to_main')]
  ]);
}

function getHelpMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔙 Назад', 'back_to_main'),
      Markup.button.callback('📩 Поддержка', 'support')
    ]
  ]);
}

// Улучшенный обработчик callback-запросов
async function safeAnswerCbQuery(ctx, text, showAlert = false) {
  try {
    await ctx.answerCbQuery(text || '', { show_alert: showAlert });
    return true;
  } catch (e) {
    console.warn('Callback answer error:', e.message);
    return false;
  }
}

// Обработчики команд
bot.start((ctx) => {
  const userId = ctx.from.id;
  
  if (!userSettings.has(userId)) {
    userSettings.set(userId, getDefaultSettings());
  }
  
  const settings = userSettings.get(userId);
  
  // Проверяем, есть ли сохраненный токен для пользователя
  if (userTokens.has(userId) && userTokens.get(userId) === API_TOKEN) {
    settings.hasToken = true;
    userSettings.set(userId, settings);
    showMainMenu(ctx);
  } else {
    ctx.replyWithMarkdown(`
🔒 *Добро пожаловать в UBT Uniccal!* 🔒

Для использования бота требуется *API токен*.

Пожалуйста, введи API токен, который ты получил:
    `, {
      reply_to_message_id: ctx.message?.message_id
    }).catch(e => console.error('Ошибка отправки сообщения:', e));
  }
});

function showMainMenu(ctx) {
  const userId = ctx.from.id;
  const settings = userSettings.get(userId) || getDefaultSettings();
  
  ctx.replyWithMarkdown(`
🎨 *UBT Uniccal* — мощный инструмент для уникализации фотографий!

*Текущая мощность:* ${getIntensityName(settings.intensity)}

*Как использовать:*
1. Отправь фото (можно несколько)
2. Настрой эффекты (по желанию)
3. Выбери "Уникализировать"
4. Выбери сколько раз обработать
5. Получи потрясающий результат!

_Выбери действие:_
  `, {
    ...getMainMenu(userId),
    reply_to_message_id: ctx.message?.message_id
  }).catch(e => console.error('Ошибка отправки меню:', e));
}

bot.on('text', (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  
  if (!userSettings.has(userId)) {
    userSettings.set(userId, getDefaultSettings());
  }
  
  const settings = userSettings.get(userId);
  
  if (!settings.hasToken) {
    if (text === API_TOKEN) {
      settings.hasToken = true;
      userSettings.set(userId, settings);
      userTokens.set(userId, API_TOKEN); // Сохраняем токен для пользователя
      
      ctx.replyWithMarkdown(`
✅ *Токен принят!* Теперь ты можешь использовать все возможности бота!

🎉 *UBT Uniccal* готов к работе!

*Текущая мощность:* ${getIntensityName(settings.intensity)}

_Выбери действие:_
      `, {
        ...getMainMenu(userId),
        reply_to_message_id: ctx.message.message_id
      }).then(() => {
        // Удаляем предыдущие сообщения
        if (ctx.message.message_id > 1) {
          ctx.deleteMessage(ctx.message.message_id - 1).catch(e => {});
        }
      }).catch(e => console.error('Ошибка отправки меню:', e));
    } else {
      ctx.reply('❌ Неверный токен. Попробуй еще раз.', {
        reply_to_message_id: ctx.message.message_id
      }).catch(e => console.error('Ошибка отправки сообщения:', e));
    }
  }
});

// Обработка фото
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = userSettings.get(userId) || getDefaultSettings();
  
  if (!settings.hasToken) {
    return ctx.reply('🔒 Для использования бота требуется API токен.', {
      reply_to_message_id: ctx.message.message_id
    }).catch(e => console.error('Ошибка отправки сообщения:', e));
  }
  
  const mediaGroupId = ctx.message.media_group_id;

  if (mediaGroupId) {
    if (!mediaGroups.has(mediaGroupId)) {
      mediaGroups.set(mediaGroupId, []);
      setTimeout(async () => {
        const messages = mediaGroups.get(mediaGroupId);
        if (!messages) return;

        const sorted = messages.sort((a, b) => a.message_id - b.message_id).slice(0, 10);
        mediaGroups.delete(mediaGroupId);

        await ctx.replyWithMarkdown(`📥 *Получил ${sorted.length} фото, готов к обработке...*`, {
          reply_to_message_id: sorted[sorted.length - 1].message_id
        }).catch(e => console.error('Ошибка отправки сообщения:', e));

        const photoBuffers = [];
        for (const msg of sorted) {
          const largestPhoto = msg.photo[msg.photo.length - 1];
          const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
          const buffer = (await axios.get(fileLink.href, { responseType: 'arraybuffer' })).data;
          photoBuffers.push(buffer);
        }

        userLastPhotos.set(userId, photoBuffers);
        await ctx.replyWithMarkdown('📷 Выбери сколько раз обработать эти фото:', {
          ...getProcessMenu(),
          reply_to_message_id: ctx.message.message_id
        }).catch(e => console.error('Ошибка отправки меню:', e));
      }, 1000);
    }

    mediaGroups.get(mediaGroupId).push(ctx.message);
  } else {
    try {
      await ctx.replyWithMarkdown('📥 *Получил фото, готов к обработке...*', {
        reply_to_message_id: ctx.message.message_id
      }).catch(e => console.error('Ошибка отправки сообщения:', e));
      
      const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
      const buffer = (await axios.get(fileLink.href, { responseType: 'arraybuffer' })).data;

      userLastPhotos.set(userId, [buffer]);
      await ctx.replyWithMarkdown('📷 Выбери сколько раз обработать это фото:', {
        ...getProcessMenu(),
        reply_to_message_id: ctx.message.message_id
      }).catch(e => console.error('Ошибка отправки меню:', e));
    } catch (err) {
      console.error('Ошибка загрузки фото:', err);
      ctx.reply('⚠️ Произошла ошибка при загрузке фото. Попробуй снова.', {
        reply_to_message_id: ctx.message.message_id
      }).catch(e => console.error('Ошибка отправки сообщения:', e));
    }
  }
});

// Обработчики кнопок
bot.action('process', async (ctx) => {
  const userId = ctx.from.id;
  const lastPhotos = userLastPhotos.get(userId);

  if (!lastPhotos || lastPhotos.length === 0) {
    return safeAnswerCbQuery(ctx, '❌ Нет фото для обработки');
  }

  await safeAnswerCbQuery(ctx);
  await ctx.editMessageText('📷 Выбери сколько раз обработать фото:', {
    ...getProcessMenu()
  }).catch(e => console.error('Ошибка редактирования сообщения:', e));
});

// Обработка нажатий кнопок обработки фото
const setupProcessHandlers = () => {
  for (let i = 1; i <= 6; i++) {
    bot.action(`process_${i}`, async (ctx) => {
      const userId = ctx.from.id;
      const lastPhotos = userLastPhotos.get(userId);
      const settings = userSettings.get(userId) || getDefaultSettings();
      
      if (!lastPhotos || lastPhotos.length === 0) {
        return safeAnswerCbQuery(ctx, '❌ Нет фото для обработки');
      }
      
      // Сразу отвечаем на callback
      await safeAnswerCbQuery(ctx, `Обрабатываю ${i} раз...`);
      
      try {
        // Удаляем предыдущее сообщение с меню
        await ctx.deleteMessage().catch(e => {});
      } catch (e) {
        console.error('Ошибка удаления сообщения:', e);
      }
      
      const processingMessage = await ctx.replyWithMarkdown(`🔄 *Обрабатываю ${lastPhotos.length} фото ${i} раз с мощностью ${getIntensityName(settings.intensity)}...*\n_Это может занять время..._`, {
        parse_mode: 'Markdown'
      }).catch(e => console.error('Ошибка отправки сообщения:', e));

      // Обрабатываем i раз
      for (let j = 0; j < i; j++) {
        const results = [];
        for (let k = 0; k < lastPhotos.length; k++) {
          try {
            // Обновляем статус обработки
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              processingMessage.message_id,
              null,
              `🔄 *Обработка ${j+1}/${i} (фото ${k+1}/${lastPhotos.length})...*\n_Мощность: ${getIntensityName(settings.intensity)}_`,
              { parse_mode: 'Markdown' }
            ).catch(e => {});
            
            const outPath = await processImage(userId, lastPhotos[k], settings.intensity);
            results.push({ type: 'photo', media: { source: outPath } });
          } catch (e) {
            console.error('Ошибка обработки фото:', e);
          }
        }
        
        if (results.length > 0) {
          await ctx.replyWithMediaGroup(results).catch(e => console.error('Ошибка отправки медиагруппы:', e));
          results.forEach(r => {
            try {
              fs.unlinkSync(r.media.source);
            } catch (e) {
              console.error('Ошибка удаления файла:', e);
            }
          });
        }
      }

      // Удаляем сообщение о процессе обработки
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id).catch(e => {});
      } catch (e) {
        console.error('Ошибка удаления сообщения:', e);
      }
      
      await ctx.replyWithMarkdown(`✨ *Готово!*\nФото обработаны ${i} раз с мощностью ${getIntensityName(settings.intensity)}!`, {
        ...getMainMenu(userId),
        reply_to_message_id: ctx.message?.message_id
      }).catch(e => console.error('Ошибка отправки сообщения:', e));
    });
  }
};
setupProcessHandlers();

// Обработчики мощности
const setupIntensityHandlers = () => {
  for (let i = 1; i <= 6; i++) {
    bot.action(`intensity_${i}`, async (ctx) => {
      const userId = ctx.from.id;
      const settings = userSettings.get(userId) || getDefaultSettings();
      
      settings.intensity = i;
      userSettings.set(userId, settings);
      
      await safeAnswerCbQuery(ctx, `Мощность установлена: ${getIntensityName(i)}`);
      ctx.editMessageText(`⚙️ *Настройки эффектов:*\nТекущая мощность: ${getIntensityName(i)}`, {
        parse_mode: 'Markdown',
        ...getSettingsMenu(userId)
      }).catch(e => console.error('Ошибка редактирования сообщения:', e));
    });
  }
};
setupIntensityHandlers();

// Основные обработчики действий
bot.action('settings', async (ctx) => {
  await safeAnswerCbQuery(ctx);
  const userId = ctx.from.id;
  ctx.editMessageText('⚙️ *Настройки эффектов:*\nВключи/выключи нужные эффекты:', {
    parse_mode: 'Markdown',
    ...getSettingsMenu(userId)
  }).catch(e => console.error('Ошибка редактирования сообщения:', e));
});

bot.action('set_intensity', async (ctx) => {
  await safeAnswerCbQuery(ctx);
  ctx.editMessageText('💪 *Выбери мощность обработки:*\n(Чем выше мощность, тем сильнее эффекты)', {
    parse_mode: 'Markdown',
    ...getIntensityMenu()
  }).catch(e => console.error('Ошибка редактирования сообщения:', e));
});

bot.action('help', async (ctx) => {
  await safeAnswerCbQuery(ctx);
  ctx.editMessageText(`
ℹ️ *Помощь по UBT Uniccal!*

*Как использовать:*
1. Отправь боту одно или несколько фото
2. Настрой эффекты (по желанию)
3. Выбери "Уникализировать"
4. Выбери сколько раз обработать (1-6)
5. Получи потрясающий результат!

*Мощность обработки:*
- 😊 Слабо - минимальные изменения
- 😃 Легко - небольшие эффекты
- 😎 Нормально - сбалансированная обработка
- 💪 Сильно - заметные изменения
- 🔥 Очень сильно - интенсивные эффекты
- 🚀 Нереально - максимальная уникализация

Для настройки перейди в *"Настройки"*.
  `, {
    parse_mode: 'Markdown',
    ...getHelpMenu()
  }).catch(e => console.error('Ошибка редактирования сообщения:', e));
});

bot.action('premium', async (ctx) => {
  await safeAnswerCbQuery(ctx, '🚀 Премиум версия скоро будет доступна!', true);
});

bot.action('support', async (ctx) => {
  await safeAnswerCbQuery(ctx, '📩 Свяжитесь с @dimon_fomo для помощи');
});

bot.action('back_to_main', async (ctx) => {
  await safeAnswerCbQuery(ctx);
  try {
    // Удаляем предыдущее сообщение
    await ctx.deleteMessage().catch(e => {});
  } catch (e) {
    console.error('Ошибка удаления сообщения:', e);
  }
  showMainMenu(ctx);
});

bot.action('back_to_settings', async (ctx) => {
  await safeAnswerCbQuery(ctx);
  const userId = ctx.from.id;
  ctx.editMessageText('⚙️ *Настройки эффектов:*\nВключи/выключи нужные эффекты:', {
    parse_mode: 'Markdown',
    ...getSettingsMenu(userId)
  }).catch(e => console.error('Ошибка редактирования сообщения:', e));
});

// Тогглы настроек
const toggleSettings = {
  'toggle_blur_bg': 'blurBackground',
  'toggle_blur_main': 'blurMainImage',
  'toggle_smileys': 'addSmileys',
  'toggle_texture': 'addTexture',
  'toggle_vignette': 'addVignette',
  'toggle_lightleak': 'addLightLeak',
  'toggle_grain': 'addGrain',
  'toggle_glow': 'addGlow',
  'toggle_scratches': 'addScratches',
  'toggle_color_filter': 'colorFilter',
  'toggle_colorful_bg': 'colorfulBackground'
};

Object.entries(toggleSettings).forEach(([action, setting]) => {
  bot.action(action, async (ctx) => {
    const userId = ctx.from.id;
    const settings = userSettings.get(userId) || getDefaultSettings();
    settings[setting] = !settings[setting];
    userSettings.set(userId, settings);

    await safeAnswerCbQuery(ctx);
    ctx.editMessageReplyMarkup(getSettingsMenu(userId).reply_markup)
      .catch(e => console.error('Ошибка редактирования сообщения:', e));
  });
});

// Глобальная обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Запуск бота в режиме long polling (без Webhook)
bot.launch()
  .then(() => {
    console.log('✅ Бот запущен в режиме polling');
  })
  .catch((err) => {
    console.error('❌ Ошибка запуска бота:', err);
  });

// Обработка ошибок
process.on('unhandledRejection', (err) => console.error('❗ Unhandled:', err));
process.on('uncaughtException', (err) => console.error('❗ Exception:', err));