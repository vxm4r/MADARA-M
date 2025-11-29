// ============================================================
// 📝 Example Plugin
// ============================================================

/**
 * مثال على ملحق بسيط
 * يمكنك نسخ هذا الملف وتعديله لإنشاء ملحقات جديدة
 */

export default {
    command: 'hello',
    aliases: ['hi', 'hey'],
    description: 'رد بسيط على التحية',
    category: 'General',
    usage: '.hello',
    
    async execute(message, args, bot) {
        try {
            const jid = message.key.remoteJid;
            const sender = message.key.participant || message.key.remoteJid;
            
            // الحصول على اسم المرسل
            const name = message.pushName || 'Friend';
            
            // إرسال الرد
            await bot.sendMessage(jid, {
                text: `👋 مرحبا ${name}! كيف حالك؟`
            }, { quoted: message });
            
        } catch (error) {
            console.error('Error in hello command:', error);
        }
    }
};
