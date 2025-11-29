// plugins/monitor.js
import os from 'os'
import { format } from 'util'

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const s = seconds % 60;
    const m = minutes % 60;
    const h = hours % 24;
    const d = days;

    const parts = [];
    if (d > 0) parts.push(`${d} يوم`);
    if (h > 0) parts.push(`${h} ساعة`);
    if (m > 0) parts.push(`${m} دقيقة`);
    if (s > 0) parts.push(`${s} ثانية`);

    return parts.join(', ') || 'أقل من ثانية';
}

function formatMemory(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

export default {
    command: ['monitor', 'uptime', 'stats'],
    owner: false,
    group: false,
    admin: false,
    botAdmin: false,
    execute: async function (conn, m, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin }) {
        const uptime = process.uptime() * 1000;
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const cpuUsage = os.loadavg();
        const stats = global.db.data.stats || {};
        
        let statsText = '';
        const sortedStats = Object.entries(stats).sort(([, a], [, b]) => b - a).slice(0, 10);
        
        if (sortedStats.length > 0) {
            statsText = sortedStats.map(([cmd, count], index) => 
                `*${index + 1}.* ${cmd} (${count} استخدام)`
            ).join('\n');
        } else {
            statsText = 'لا توجد إحصائيات أوامر بعد.';
        }

        const monitorText = `
*📊 نظام المراقبة الشامل والأداء 📊*

*⏱️ وقت التشغيل (Uptime):*
${formatTime(uptime)}

*💻 معلومات النظام:*
- *نظام التشغيل:* ${os.type()} ${os.release()}
- *المعمارية:* ${os.arch()}
- *المعالج (CPU):* ${os.cpus().length} أنوية
- *متوسط الحمل (Load Avg):* ${cpuUsage.map(n => n.toFixed(2)).join(', ')}

*🧠 استخدام الذاكرة (Memory):*
- *الإجمالي:* ${formatMemory(totalMemory)}
- *المستخدم:* ${formatMemory(usedMemory)}
- *المتاح:* ${formatMemory(freeMemory)}

*🚀 إحصائيات الأوامر الأكثر استخدامًا (Top 10):*
${statsText}

*ملاحظة:* تم دمج تحسينات السرعة في المعالج الأساسي لضمان أداء فائق.
`;
        
        m.reply(monitorText);
    }
}
