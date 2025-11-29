// plugins/speed.js

export default {
    command: ['ping', 'speed'],
    owner: false,
    group: false,
    admin: false,
    botAdmin: false,
    execute: async function (conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin }) {
        const startTime = Date.now();
        
        await conn.reply(m.chat, '⏱️ جاري قياس السرعة...', m);
        
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        const speedText = `
*🚀 سرعة الاستجابة (Ping) 🚀*

*الزمن:* ${latency} مللي ثانية (ms)

*ملاحظة:* هذه السرعة تمثل زمن الاستجابة بين البوت وواتساب.
`;
        
        m.reply(speedText);
    }
}
