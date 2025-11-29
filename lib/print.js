import PhoneNumber from 'awesome-phonenumber';
import chalk from 'chalk';
import boxen from 'boxen';
import gradient from 'gradient-string';
import urlRegex from 'url-regex-safe';
import { watchFile } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

export default async function printLog(m, conn = { user: {} }) {
  // هذا الملف مأخوذ من pasted_content_4.txt مع تعديلات طفيفة
  
  // التاريخ والوقت
  const now = new Date();
  const dateStr = now.toLocaleDateString('ar-EG');
  const timeStr = now.toLocaleTimeString('it-IT', { hour12: false }).slice(0, 8);

  // أيقونة حسب وقت اليوم
  const hour = now.getHours();
  const dayIcon = hour < 6 ? '🌙'
                  : hour < 12 ? '☀️'
                  : hour < 18 ? '🌤️'
                  : '🌙';

  // نوع الرسالة والتدرج اللوني
  const typeRaw = (m.mtype || '').replace(/message$/i, '').toUpperCase() || '-';
  const grad = typeRaw === 'IMAGE'
    ? gradient(['#ff5f6d', '#ffc371'])
    : gradient.rainbow;
  const stamp = grad(`${dayIcon} ${dateStr} ${timeStr}`);

  // خريطة الرموز التعبيرية حسب نوع الرسالة
  const typeIcons = {
    TEXT: '📝',
    IMAGE: '🖼️',
    VIDEO: '🎬',
    AUDIO: '🎵',
    DOCUMENT: '📄',
    STICKER: '🏷️',
    LOCATION: '📍',
    CONTACT: '👤',
    PROTOCOL: '⚙️',
    VIEWONCE: '⏳',
    EPHEMERAL: '🔒',
    UNKNOWN: '💭'
  };
  const typeIcon = typeIcons[typeRaw] || typeIcons.UNKNOWN;

  // المرسل والاسم
  const name = await conn.getName(m.sender);
  const sender =
    PhoneNumber('+' + m.sender.replace('@s.whatsapp.net', '')).getNumber('international') +
    (name ? ` ~${name}` : '');

  // ID الرسالة
  const msgId = m.key?.id || '-';

  // اسم الدردشة مع رمز تعبيري حسب المجموعة/الخاص
  const chatRaw = await conn.getName(m.chat);
  const chatNameRaw = chatRaw
    ? m.isGroup
      ? `مجموعة: ${chatRaw}`
      : `خاص: ${chatRaw}`
    : '-';
  const chatEmoji = m.isGroup ? '👥' : '🗨️';
  const chatName = `${chatEmoji}  ${chatNameRaw}`;

  // كشف إعادة التوجيه
  const fwdIcon = m.isForwarded ? ' 🔁' : '';

  // حالة الرؤية
  const vis = m.message?.viewOnceMessage
    ? ' ⏳'
    : m.message?.ephemeralMessage
    ? ' 🔒'
    : '';

  // الحجم
  let size = 0;
  if (m.msg) size = m.msg.fileLength?.low || m.msg.fileLength || 0;
  else size = m.text?.length || 0;
  const humanSize = size > 0 ? `${(size / 1024).toFixed(1)}KB` : '-';

  // معالجة النص
  let text = m.text || '';
  text = text.replace(/\u200e+/g, '');

  // تلوين الروابط والماركداون
  const urlPattern = urlRegex({ strict: false });
  text = text.replace(urlPattern, u => chalk.blueBright('🔗 ' + u));
  text = text.replace(/([*_~])(.+?)\1/g, (_, m1, t) => {
    if (m1 === '*') return chalk.bold(t);
    if (m1 === '_') return chalk.italic(t);
    if (m1 === '~') return chalk.strikethrough(t);
    return t;
  });

  // اقتطاع النص الطويل
  const MAX = 500;
  if (text.length > MAX) {
    text = text.slice(0, MAX) + chalk.gray('…[مقتطع]');
  }

  // اقتباس الرسالة
  let quoteLine = null;
  if (m.quoted?.text) {
    const quote = m.quoted.text.slice(0, 100).replace(/\n/g, ' ');
    quoteLine = `💬  ${quote}${m.quoted.text.length > 100 ? '...' : ''}`;
  }

  // بناء خطوط الإخراج
  const lines = [
    `${chalk.gray('ID:       ')} ${chalk.yellow(msgId)}`,
    `${chalk.gray('المرسل:   ')} ${sender}`,
    `${chalk.gray('الدردشة:  ')} ${chatName}`,
    `${vis ? chalk.gray('الرؤية:   ') + vis : ''}`,
    `${chalk.gray('النوع:    ')} ${typeIcon}  ${chalk.magenta(typeRaw)}${fwdIcon}`,
    `${chalk.gray('الحجم:    ')} ${humanSize}`,
    quoteLine,
    text ? `
${text}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  // عرض في الكونسول باستخدام Boxen
  console.log(
    boxen(lines, {
      title: `${stamp}`,
      titleAlignment: 'left',
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    })
  );
}

// المراقبة الحية
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'print.js');
watchFile(file, () => console.log(chalk.redBright('≫ lib/print.js تم تحديثه')));
