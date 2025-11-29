import { startSubBot, stopSubBot, loadAllSubBots } from '../lib/subbot.js'
import chalk from 'chalk'

const command = ['تنصيب', 'jadibot', 'subbot', 'stopsub']

export default {
    command: command,
    name: 'Jadibot',
    category: 'Owner',
    owner: true,
    handler: async function (m, { conn, command, text, args, isOwner }) {
        
        if (!global.CAN_INSTALL) {
            return m.reply('عفواً، تم إيقاف نظام التنصيب (Jadibot) من قبل المطور.')
        }

        const cmd = command.toLowerCase()
        
        if (cmd === 'تنصيب' || cmd === 'jadibot' || cmd === 'subbot') {
            if (global.conns.length >= global.SUB_BOT_LIMIT) {
                return m.reply(`عفواً، لقد تم الوصول للحد الأقصى من البوتات الفرعية (${global.SUB_BOT_LIMIT}).`)
            }
            
            const sessionId = m.sender.split('@')[0]
            
            if (global.conns.some(c => c.sessionId === sessionId)) {
                return m.reply('لديك بالفعل جلسة بوت فرعية قيد التشغيل.')
            }
            
            m.reply('جاري بدء جلسة البوت الفرعية. يرجى الانتظار للحصول على رمز QR أو رمز الاقتران.')
            
            try {
                const subConn = await startSubBot(sessionId, conn)
                
                // هنا يجب أن يكون هناك آلية لإرسال الـ QR أو رمز الاقتران للمستخدم
                // بما أننا في بيئة ساندبوكس، سنكتفي برسالة توجيهية
                m.reply(`تم بدء جلسة البوت الفرعية بنجاح.
                
*ملاحظة:* يجب عليك الآن مسح رمز QR أو إدخال رمز الاقتران في وحدة التحكم الخاصة بالبوت لتسجيل الدخول.`)
                
            } catch (e) {
                console.error(chalk.red('Error starting sub-bot:'), e)
                m.reply('حدث خطأ أثناء بدء جلسة البوت الفرعية.')
            }
            
        } else if (cmd === 'stopsub') {
            const sessionId = m.sender.split('@')[0]
            
            if (!global.conns.some(c => c.sessionId === sessionId)) {
                return m.reply('ليس لديك جلسة بوت فرعية قيد التشغيل لإيقافها.')
            }
            
            const stopped = await stopSubBot(sessionId)
            
            if (stopped) {
                m.reply('تم إيقاف جلسة البوت الفرعية بنجاح.')
            } else {
                m.reply('حدث خطأ أثناء إيقاف جلسة البوت الفرعية.')
            }
        }
    }
}
