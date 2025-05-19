const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');
const express = require('express');

const bot = new Telegraf('7523881725:AAFRjNltWDXco--Pd2N93WqfZQhSwpuFdnM');
const API_TOKEN = 'jihhwop0pr8i763ojjhjjp990';
const app = express();
const PORT = process.env.PORT || 3000;

// Оптимизированные хранилища данных
const mediaGroups = new Map();
const userLastPhotos = new Map();
const userSettings = new Map();
const userTokens = new Map();

// Конфигурация производительности
const PERFORMANCE_CONFIG = {
  PROCESS_TIMEOUT: 300000, // 5 минут на обработку
  MAX_PHOTOS: 10,
  MAX_PHOTO_SIZE: 720,
  BACKGROUND_QUALITY: 80,
  OUTPUT_QUALITY: 85,
  CACHE_TTL: 3600000 // 1 час
};

// Папка для ассетов
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
  fs.mkdirSync(path.join(assetsDir, 'smileys'));
  fs.mkdirSync(path.join(assetsDir, 'textures'));
  console.log('Создана папка assets. Добавьте туда изображения для смайликов и текстур.');
}

// Безопасный ответ на callback-запросы
async function safeAnswerCbQuery(ctx, text = '', showAlert = false) {
  try {
    await ctx.answerCbQuery(text, { show_alert: showAlert });
  } catch (e) {
    console.log('Callback answer error:', e.message);
  }
}

// Оптимизированная загрузка ассетов
const loadAssets = () => {
  const assets = { smileys: [], textures: [] };
  
  const loadDir = (dir, type) => {
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(file => {
        if (file.match(/\.(jpg|jpeg|png)$/)) {
          assets[type].push(path.join(dir, file));
        }
      });
    }
  };
  
  loadDir(path.join(assetsDir, 'smileys'), 'smileys');
  loadDir(path.join(assetsDir, 'textures'), 'textures');
  
  return assets;
};

const { smileys, textures } = loadAssets();
console.log(`Загружено ${smileys.length} смайликов и ${textures.length} текстур`);

// Генерация фонов с кэшированием
const backgroundCache = new Map();

const generateBackground = async (type = 'random') => {
  const cacheKey = type;
  if (backgroundCache.has(cacheKey)) {
    return backgroundCache.get(cacheKey);
  }

  try {
    let url;
    const baseUrl = 'https://picsum.photos';
    const size = `${PERFORMANCE_CONFIG.MAX_PHOTO_SIZE}/${PERFORMANCE_CONFIG.MAX_PHOTO_SIZE}`;
    
    switch(type) {
      case 'colorful':
        url = `${baseUrl}/${size}`;
        break;
      case 'grayscale':
        url = `${baseUrl}/${size}?grayscale`;
        break;
      case 'blur':
        url = `${baseUrl}/${size}?blur=5`;
        break;
      default:
        url = Math.random() > 0.5 ? 
          `${baseUrl}/${size}` : 
          `${baseUrl}/${size}?grayscale`;
    }
    
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000 
    });
    const buffer = Buffer.from(response.data);
    
    // Кэшируем на 1 час
    backgroundCache.set(cacheKey, buffer);
    setTimeout(() => backgroundCache.delete(cacheKey), PERFORMANCE_CONFIG.CACHE_TTL);
    
    return buffer;
  } catch (err) {
    console.log('Using fallback background:', err.message);
    const colors = [
      '#222222', '#3a0ca3', '#f72585', '#4cc9f0', '#2b2d42',
      '#ff9e00', '#8338ec', '#3a86ff', '#ff006e', '#fb5607'
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const img = await Jimp.create(PERFORMANCE_CONFIG.MAX_PHOTO_SIZE, PERFORMANCE_CONFIG.MAX_PHOTO_SIZE, color);
    return img.getBufferAsync(Jimp.MIME_JPEG);
  }
};

// Оптимизированные эффекты
const effects = {
  async addNoise(image, intensity = 500) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const pixels = intensity / 1000;

    for (let i = 0; i < w * h * pixels; i++) {
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
        console.error('Ошибка добавления смайлика:', e.message);
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
      console.error('Ошибка добавления текстуры:', e.message);
    }
    return image;
  },

  async addVignette(image, intensity = 0.7) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    image.scan(0, 0, w, h, (x, y, idx) => {
      const dist = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
      const darkness = (dist / maxDist) * intensity;
      
      image.bitmap.data[idx] *= (1 - darkness);
      image.bitmap.data[idx + 1] *= (1 - darkness);
      image.bitmap.data[idx + 2] *= (1 - darkness);
    });
    
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
      console.error('Ошибка добавления light leak:', e.message);
    }
    return image;
  },

  async addGrain(image, intensity = 0.3) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    image.scan(0, 0, w, h, (x, y, idx) => {
      if (Math.random() > intensity) return;
      
      const grain = Math.floor(Math.random() * 60) - 30;
      image.bitmap.data[idx] = Math.max(0, Math.min(255, image.bitmap.data[idx] + grain));
      image.bitmap.data[idx + 1] = Math.max(0, Math.min(255, image.bitmap.data[idx + 1] + grain));
      image.bitmap.data[idx + 2] = Math.max(0, Math.min(255, image.bitmap.data[idx + 2] + grain));
    });
    
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
    const filters = {
      sepia: () => image.sepia(),
      vintage: () => image.color([{ apply: 'mix', params: ['#704214', 30] }]),
      cool: () => image.color([{ apply: 'mix', params: ['#1e90ff', 10] }]),
      warm: () => image.color([{ apply: 'mix', params: ['#ff4500', 10] }])
    };
    
    if (filters[filter]) {
      filters[filter]();
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

// Оптимизированная обработка изображения
async function processImage(userId, buffer, intensity = 3) {
  const settings = userSettings.get(userId) || getDefaultSettings();
  const filters = ['sepia', 'vintage', 'cool', 'warm'];
  
  // Генерация фона
  let bgImage = await Jimp.read(await generateBackground(
    settings.colorfulBackground ? 'colorful' : 'random'
  ));
  
  if (settings.blurBackground) {
    bgImage.blur(10);
  }
  
  // Применение эффектов к фону
  await effects.addNoise(bgImage, settings.noiseIntensity * intensity / 3);
  
  if (settings.addTexture) {
    await effects.addTexture(bgImage, 0.2 * intensity / 3);
  }
  
  if (settings.addVignette) {
    await effects.addVignette(bgImage, 0.7 * intensity / 3);
  }

  // Обработка основного изображения
  let mainImage = await Jimp.read(buffer);
  const maxWidth = bgImage.bitmap.width * 0.7;
  const maxHeight = bgImage.bitmap.height * 0.7;
  const scale = Math.min(
    maxWidth / mainImage.bitmap.width, 
    maxHeight / mainImage.bitmap.height, 
    1
  );
  
  mainImage.resize(
    Math.floor(mainImage.bitmap.width * scale), 
    Math.floor(mainImage.bitmap.height * scale)
  );
  
  if (settings.blurMainImage) {
    mainImage.blur(1 * intensity / 3);
  }
  
  if (settings.addGrain) {
    await effects.addGrain(mainImage, 0.3 * intensity / 3);
  }

  // Позиционирование основного изображения
  const offsetX = Math.floor(Math.random() * 31) - 15;
  const offsetY = Math.floor(Math.random() * 31) - 15;
  const x = Math.floor((bgImage.bitmap.width - mainImage.bitmap.width) / 2) + offsetX;
  const y = Math.floor((bgImage.bitmap.height - mainImage.bitmap.height) / 2) + offsetY;

  bgImage.composite(mainImage, x, y);

  // Дополнительные эффекты
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

  // Сохранение результата
  const outPath = path.join(__dirname, `out_${userId}_${Date.now()}.jpg`);
  await bgImage.quality(PERFORMANCE_CONFIG.OUTPUT_QUALITY).writeAsync(outPath);
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
    intensity: 3
  };
}

// Оптимизированные меню
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
    [Markup.button.callback('4 раза 💪', 'process_4')],
    [Markup.button.callback('5 раз 🔥', 'process_5')],
    [Markup.button.callback('6 раз 🚀', 'process_6')],
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

// Обработчики команд
bot.start((ctx) => {
  const userId = ctx.from.id;
  
  if (!userSettings.has(userId)) {
    userSettings.set(userId, getDefaultSettings());
  }
  
  const settings = userSettings.get(userId);
  
  if (userTokens.has(userId) && userTokens.get(userId) === API_TOKEN) {
    settings.hasToken = true;
    userSettings.set(userId, settings);
    showMainMenu(ctx);
  } else {
    ctx.replyWithMarkdown(`
🔒 *Добро пожаловать в UBT Uniccal!* 🔒

Для использования бота требуется *API токен*.

Пожалуйста, введи API токен, который ты получил:
    `).catch(e => console.error('Ошибка отправки сообщения:', e.message));
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
  `, getMainMenu(userId)).catch(e => console.error('Ошибка отправки меню:', e.message));
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
      userTokens.set(userId, API_TOKEN);
      
      ctx.replyWithMarkdown(`
✅ *Токен принят!* Теперь ты можешь использовать все возможности бота!

🎉 *UBT Uniccal* готов к работе!

*Текущая мощность:* ${getIntensityName(settings.intensity)}

_Выбери действие:_
      `, getMainMenu(userId)).then(() => {
        if (ctx.message.message_id > 1) {
          ctx.deleteMessage(ctx.message.message_id - 1).catch(() => {});
        }
      }).catch(e => console.error('Ошибка отправки меню:', e.message));
    } else {
      ctx.reply('❌ Неверный токен. Попробуй еще раз.').catch(e => console.error('Ошибка отправки сообщения:', e.message));
    }
  }
});

// Обработка фото с оптимизацией
bot.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const settings = userSettings.get(userId) || getDefaultSettings();
  
  if (!settings.hasToken) {
    return ctx.reply('🔒 Для использования бота требуется API токен.').catch(e => console.error('Ошибка отправки сообщения:', e.message));
  }
  
  const mediaGroupId = ctx.message.media_group_id;

  if (mediaGroupId) {
    if (!mediaGroups.has(mediaGroupId)) {
      mediaGroups.set(mediaGroupId, []);
      setTimeout(async () => {
        const messages = mediaGroups.get(mediaGroupId);
        if (!messages) return;

        const sorted = messages.sort((a, b) => a.message_id - b.message_id).slice(0, PERFORMANCE_CONFIG.MAX_PHOTOS);
        mediaGroups.delete(mediaGroupId);

        await ctx.replyWithMarkdown(`📥 *Получил ${sorted.length} фото, готов к обработке...*`).catch(e => console.error('Ошибка отправки сообщения:', e.message));

        const photoBuffers = [];
        for (const msg of sorted) {
          try {
            const largestPhoto = msg.photo[msg.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
            const buffer = (await axios.get(fileLink.href, { 
              responseType: 'arraybuffer',
              timeout: 10000 
            })).data;
            photoBuffers.push(buffer);
          } catch (e) {
            console.error('Ошибка загрузки фото:', e.message);
          }
        }

        if (photoBuffers.length > 0) {
          userLastPhotos.set(userId, photoBuffers);
          await ctx.replyWithMarkdown('📷 Выбери сколько раз обработать эти фото:', getProcessMenu()).catch(e => console.error('Ошибка отправки меню:', e.message));
        }
      }, 1000);
    }

    mediaGroups.get(mediaGroupId).push(ctx.message);
  } else {
    try {
      await ctx.replyWithMarkdown('📥 *Получил фото, готов к обработке...*').catch(e => console.error('Ошибка отправки сообщения:', e.message));
      
      const largestPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
      const buffer = (await axios.get(fileLink.href, { 
        responseType: 'arraybuffer',
        timeout: 10000 
      })).data;

      userLastPhotos.set(userId, [buffer]);
      await ctx.replyWithMarkdown('📷 Выбери сколько раз обработать это фото:', getProcessMenu()).catch(e => console.error('Ошибка отправки меню:', e.message));
    } catch (err) {
      console.error('Ошибка загрузки фото:', err.message);
      ctx.reply('⚠️ Произошла ошибка при загрузке фото. Попробуй снова.').catch(e => console.error('Ошибка отправки сообщения:', e.message));
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
  await ctx.editMessageText('📷 Выбери сколько раз обработать фото:', getProcessMenu()).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
});

// Обработка фото с таймаутом
for (let i = 1; i <= 6; i++) {
  bot.action(`process_${i}`, async (ctx) => {
    const userId = ctx.from.id;
    const lastPhotos = userLastPhotos.get(userId);
    const settings = userSettings.get(userId) || getDefaultSettings();
    
    if (!lastPhotos || lastPhotos.length === 0) {
      return safeAnswerCbQuery(ctx, '❌ Нет фото для обработки');
    }
    
    await safeAnswerCbQuery(ctx, `Обрабатываю ${i} раз...`);
    
    try {
      await ctx.deleteMessage().catch(() => {});
    } catch (e) {
      console.error('Ошибка удаления сообщения:', e.message);
    }
    
    const processingMessage = await ctx.replyWithMarkdown(`🔄 *Обрабатываю ${lastPhotos.length} фото ${i} раз с мощностью ${getIntensityName(settings.intensity)}...*\n_Это может занять время..._`).catch(e => console.error('Ошибка отправки сообщения:', e.message));

    // Обработка с таймаутом
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Превышено время обработки')), PERFORMANCE_CONFIG.PROCESS_TIMEOUT)
    );
    
    try {
      const processPromise = (async () => {
        for (let j = 0; j < i; j++) {
          const results = [];
          for (let k = 0; k < lastPhotos.length; k++) {
            try {
              await ctx.telegram.editMessageText(
                ctx.chat.id,
                processingMessage.message_id,
                null,
                `🔄 *Обработка ${j+1}/${i} (фото ${k+1}/${lastPhotos.length})...*\n_Мощность: ${getIntensityName(settings.intensity)}_`
              ).catch(() => {});
              
              const outPath = await processImage(userId, lastPhotos[k], settings.intensity);
              results.push({ type: 'photo', media: { source: outPath } });
            } catch (e) {
              console.error('Ошибка обработки фото:', e.message);
            }
          }
          
          if (results.length > 0) {
            await ctx.replyWithMediaGroup(results).catch(e => console.error('Ошибка отправки медиагруппы:', e.message));
            results.forEach(r => {
              try {
                fs.unlinkSync(r.media.source);
              } catch (e) {
                console.error('Ошибка удаления файла:', e.message);
              }
            });
          }
        }
      })();
      
      await Promise.race([processPromise, timeoutPromise]);
    } catch (e) {
      console.error('Ошибка обработки:', e.message);
      await ctx.reply('⚠️ Произошла ошибка при обработке фото. Попробуй снова.').catch(() => {});
    } finally {
      try {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMessage.message_id).catch(() => {});
      } catch (e) {
        console.error('Ошибка удаления сообщения:', e.message);
      }
      
      await ctx.replyWithMarkdown(`✨ *Готово!*\nФото обработаны ${i} раз с мощностью ${getIntensityName(settings.intensity)}!`, getMainMenu(userId)).catch(e => console.error('Ошибка отправки сообщения:', e.message));
    }
  });
}

// Установка мощности
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
    }).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
  });
}

bot.action('settings', (ctx) => {
  const userId = ctx.from.id;
  ctx.editMessageText('⚙️ *Настройки эффектов:*\nВключи/выключи нужные эффекты:', {
    parse_mode: 'Markdown',
    ...getSettingsMenu(userId)
  }).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
  safeAnswerCbQuery(ctx);
});

bot.action('set_intensity', (ctx) => {
  ctx.editMessageText('💪 *Выбери мощность обработки:*\n(Чем выше мощность, тем сильнее эффекты)', {
    parse_mode: 'Markdown',
    ...getIntensityMenu()
  }).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
  safeAnswerCbQuery(ctx);
});

bot.action('help', (ctx) => {
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
  }).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
  safeAnswerCbQuery(ctx);
});

bot.action('premium', (ctx) => {
  safeAnswerCbQuery(ctx, '🚀 Премиум версия скоро будет доступна!', true);
});

bot.action('support', (ctx) => {
  safeAnswerCbQuery(ctx, '📩 Свяжитесь с @dimon_fomo для помощи');
});

bot.action('back_to_main', async (ctx) => {
  try {
    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('Ошибка удаления сообщения:', e.message);
  }
  showMainMenu(ctx);
});

bot.action('back_to_settings', (ctx) => {
  const userId = ctx.from.id;
  ctx.editMessageText('⚙️ *Настройки эффектов:*\nВключи/выключи нужные эффекты:', {
    parse_mode: 'Markdown',
    ...getSettingsMenu(userId)
  }).catch(e => console.error('Ошибка редактирования сообщения:', e.message));
  safeAnswerCbQuery(ctx);
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
  bot.action(action, (ctx) => {
    const userId = ctx.from.id;
    const settings = userSettings.get(userId) || getDefaultSettings();
    settings[setting] = !settings[setting];
    userSettings.set(userId, settings);

    ctx.editMessageReplyMarkup(getSettingsMenu(userId).reply_markup)
      .catch(e => console.error('Ошибка редактирования сообщения:', e.message));

    safeAnswerCbQuery(ctx);
  });
});

// Глобальная обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err.message);
  if (ctx.callbackQuery) {
    return safeAnswerCbQuery(ctx, '⚠️ Произошла ошибка');
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error.message);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

// Express сервер
app.use(express.json());

app.post('/', (req, res) => {
  bot.handleUpdate(req.body)
    .then(() => res.sendStatus(200))
    .catch((err) => {
      console.error('❌ Ошибка при handleUpdate:', err.message);
      res.sendStatus(500);
    });
});

app.get('/', (req, res) => {
  res.send('🤖 Бот жив и принимает Webhook');
});

app.listen(PORT, () => {
  console.log(`✅ Express-сервер работает на порту ${PORT}`);
});