// plugins/owner.js

export default {
    command: ['owner', 'mod', 'devmode'],
    owner: true,
    group: false,
    admin: false,
    botAdmin: false,
    execute: async function (conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin }) {
        if (command === 'owner' || command === 'mod') {
            let owners = global.owner.map(([number, name]) => `*•* @${number} - ${name}`).join('\n');
            let mods = global.mods.map(number => `*•* @${number}`).join('\n');
            
            let ownerText = `
*👑 قائمة المطورين والمشرفين 👑*

*المطورون (Owners):*
${owners}

*المشرفون (Mods):*
${mods || 'لا يوجد مشرفون إضافيون.'}

*ملاحظة:* يمكن للمطورين التحكم في وضع البوت.
`;
            
            return conn.sendText(m.chat, ownerText, m, { mentions: global.owner.map(v => v[0] + '@s.whatsapp.net').concat(global.mods.map(v => v + '@s.whatsapp.net')) });
        }
        
        if (command === 'devmode') {
            if (!isOwner) return m.reply('❌ هذا الأمر مخصص للمطور الرئيسي فقط.');
            
            if (text.toLowerCase() === 'on') {
                global.developerMode = true;
                return m.reply('✅ تم تفعيل وضع المطورين (Developer Mode). البوت سيرد على المطورين فقط.');
            } else if (text.toLowerCase() === 'off') {
                global.developerMode = false;
                return m.reply('✅ تم تعطيل وضع المطورين (Developer Mode). البوت سيرد على الجميع.');
            } else {
                return m.reply(`*حالة وضع المطورين:* ${global.developerMode ? 'مفعل (ON)' : 'معطل (OFF)'}\n\nلاستخدام الأمر: \n${usedPrefix}devmode on/off`);
            }
        }
    }
}
