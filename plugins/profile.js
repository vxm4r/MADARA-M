// plugins/profile.js

export default {
    command: ['profile', 'me', 'stats'],
    owner: false,
    group: false,
    admin: false,
    botAdmin: false,
    execute: async function (conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin }) {
        const user = global.db.data.users[m.sender];
        
        if (!user) {
            return m.reply('❌ لم يتم العثور على بيانات المستخدم. يرجى المحاولة مرة أخرى.');
        }

        const profileText = `
*✨ ملفك الشخصي في البوت ✨*

👤 *الاسم:* ${user.name || m.pushName}
🆔 *الرقم:* ${m.sender.split('@')[0]}

📈 *المستوى والإحصائيات:*
- *المستوى:* ${user.level}
- *الخبرة (EXP):* ${user.exp}
- *الرتبة:* ${user.role}

💰 *الموارد الاقتصادية:*
- *العملات (Coins):* ${user.coin}
- *الماس (Diamond):* ${user.diamond}
- *الرصيد البنكي:* ${user.bank}

🛡️ *الحالة:*
- *الصحة (Health):* ${user.health}%
- *محظور:* ${user.banned ? '✅' : '❌'}
- *مميز (Premium):* ${user.premium ? '✅' : '❌'}

⚙️ *المعدات (Equipment):*
- *السلاح:* ${user.equipment?.weapon || 'لا يوجد'}
- *الدرع:* ${user.equipment?.armor || 'لا يوجد'}

📅 *معلومات أخرى:*
- *مسجل:* ${user.registered ? '✅' : '❌'}
- *وضع AFK:* ${user.afk > -1 ? '✅' : '❌'}
`;
        
        m.reply(profileText);
    }
}
