// plugins/install.js

export default {
    command: ['install', 'تنصيب'],
    owner: true,
    group: false,
    admin: false,
    botAdmin: false,
    execute: async function (conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin }) {
        if (!isOwner) return m.reply('❌ هذا الأمر مخصص للمطور الرئيسي فقط.');
        
        if (text.toLowerCase() === 'on') {
            global.canInstall = true;
            return m.reply('✅ تم تفعيل أمر التنصيب (Jadibot). يمكن للمستخدمين الآن استخدامه.');
        } else if (text.toLowerCase() === 'off') {
            global.canInstall = false;
            return m.reply('✅ تم تعطيل أمر التنصيب (Jadibot). لا يمكن للمستخدمين استخدامه حاليًا.');
        } else {
            return m.reply(`*حالة أمر التنصيب:* ${global.canInstall ? 'مفعل (ON)' : 'معطل (OFF)'}\n\nلاستخدام الأمر: \n${usedPrefix}install on/off`);
        }
    }
}
