import { smsg, protoType } from './lib/simple.js'
import { fileURLToPath } from 'url'
import { watchFile, unwatchFile } from 'fs'
import { Low, JSONFile } from 'lowdb'
import { join } from 'path'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { tmpdir } from 'os'
import { format } from 'util'
import { spawn } from 'child_process'
import fs from 'fs'

const __dirname = global.__dirname(import.meta.url)

// ============================================================
// 1. تحميل الملحقات (Plugins)
// ============================================================
global.plugins = {}
function readPlugins() {
    let dir = join(__dirname, 'plugins')
    let files = fs.readdirSync(dir)
    for (let file of files) {
        if (file.endsWith('.js')) {
            try {
                let module = import(join(dir, file))
                global.plugins[file] = module
            } catch (e) {
                console.error(chalk.red(`Error loading plugin ${file}:`), e)
            }
        }
    }
}
readPlugins()

// ============================================================
// 2. معالج الرسائل (Handler)
// ============================================================
export async function handler(chatUpdate) {
    this.msg = this.msg || {}
    this.chats = this.chats || {}
    
    if (!chatUpdate) return
    
    // معالجة الرسائل الواردة
    for (const m of chatUpdate.messages) {
        if (!m.message) continue
        
        // تفعيل وظيفة smsg
        m.message = (Object.keys(m.message)[0] === 'ephemeralMessage') ? m.message.ephemeralMessage.message : m.message
        const m_ = smsg(this, m)
        
        if (m_.key) {
            this.msg[m_.key.id] = m_
            this.chats[m_.chat] = this.chats[m_.chat] || []
            this.chats[m_.chat].push(m_)
        }
        
        // تجاهل رسائل البوت ورسائل الحالة
        if (m_.isBot || m_.chat.endsWith('broadcast') || m_.key.remoteJid === 'status@broadcast') continue
        
        // ============================================================
        // 3. تحديث قاعدة البيانات (Users/Chats)
        // ============================================================
        try {
            let user = global.db.data.users[m_.sender]
            if (typeof user !== 'object') global.db.data.users[m_.sender] = {}
            if (user) {
                if (!('registered' in user)) user.registered = false
                if (!('limit' in user)) user.limit = 20
                if (!('money' in user)) user.money = 0
                if (!('exp' in user)) user.exp = 0
                if (!('level' in user)) user.level = 0
                if (!('role' in user)) user.role = 'Beginner'
                if (!('lastclaim' in user)) user.lastclaim = 0
                if (!('afk' in user)) user.afk = -1
                if (!('afkReason' in user)) user.afkReason = ''
                if (!('banned' in user)) user.banned = false
                if (!('premium' in user)) user.premium = false
                if (!('premiumDate' in user)) user.premiumDate = 0
                if (!('warn' in user)) user.warn = 0
                // Add more user properties from the analyzed code
            } else {
                global.db.data.users[m_.sender] = {
                    registered: false,
                    limit: 20,
                    money: 0,
                    exp: 0,
                    level: 0,
                    role: 'Beginner',
                    lastclaim: 0,
                    afk: -1,
                    afkReason: '',
                    banned: false,
                    premium: false,
                    premiumDate: 0,
                    warn: 0,
                }
            }
            
            let chat = global.db.data.chats[m_.chat]
            if (typeof chat !== 'object') global.db.data.chats[m_.chat] = {}
            if (chat) {
                if (!('welcome' in chat)) chat.welcome = false
                if (!('antiLink' in chat)) chat.antiLink = false
                if (!('antiSpam' in chat)) chat.antiSpam = false
                if (!('delete' in chat)) chat.delete = true
                if (!('viewonce' in chat)) chat.viewonce = false
                if (!('simi' in chat)) chat.simi = false
                if (!('detect' in chat)) chat.detect = true
                if (!('sWelcome' in chat)) chat.sWelcome = ''
                if (!('sBye' in chat)) chat.sBye = ''
                // Add more chat properties
            } else {
                global.db.data.chats[m_.chat] = {
                    welcome: false,
                    antiLink: false,
                    antiSpam: false,
                    delete: true,
                    viewonce: false,
                    simi: false,
                    detect: true,
                    sWelcome: '',
                    sBye: '',
                }
            }
            
            // تحديث آخر رسالة للمستخدم
            user.lastseen = Date.now()
            chat.lastmsg = Date.now()
            
        } catch (e) {
            console.error(chalk.red('Error updating database:'), e)
        }
        
        // ============================================================
        // 4. معالجة الأوامر (Command Processing)
        // ============================================================
        const isCmd = m_.text.startsWith(global.prefix)
        const command = isCmd ? m_.text.slice(global.prefix.length).trim().split(' ')[0].toLowerCase() : ''
        const text = m_.text.slice(global.prefix.length + command.length).trim()
        
        if (isCmd) {
            let plugin = null
            for (let name in global.plugins) {
                let module = await global.plugins[name]
                if (module.default && module.default.command && module.default.command.includes(command)) {
                    plugin = module.default
                    break
                }
            }
            
            if (plugin) {
                try {
                    // تحقق من الصلاحيات (Owner/Premium/Group Admin/Banned)
                    let isOwner = global.owner.map(v => v[0] + '@s.whatsapp.net').includes(m_.sender)
                    let isPrems = isOwner || global.db.data.users[m_.sender].premium
                    let isGroup = m_.isGroup
                    let isAdmin = isGroup ? global.db.data.chats[m_.chat].isAdmin : false // يجب تحديثها
                    
                    if (plugin.owner && !isOwner) {
                        m_.reply('هذا الأمر مخصص للمطور فقط.')
                        continue
                    }
                    if (plugin.premium && !isPrems) {
                        m_.reply('هذا الأمر مخصص للمستخدمين المميزين فقط.')
                        continue
                    }
                    if (plugin.group && !isGroup) {
                        m_.reply('هذا الأمر يعمل في المجموعات فقط.')
                        continue
                    }
                    if (plugin.admin && !isAdmin) {
                        m_.reply('هذا الأمر مخصص لمسؤولي المجموعة فقط.')
                        continue
                    }
                    if (global.db.data.users[m_.sender].banned) {
                        m_.reply('أنت محظور من استخدام البوت.')
                        continue
                    }
                    
                    // تنفيذ الأمر
                    await plugin.execute(this, m_, { command, text, isOwner, isPrems, isGroup, isAdmin })
                    
                    // تحديث الإحصائيات
                    global.db.data.stats[command] = (global.db.data.stats[command] || 0) + 1
                    
                } catch (e) {
                    console.error(chalk.red(`Error executing command ${command}:`), e)
                    m_.reply(`حدث خطأ أثناء تنفيذ الأمر: \n${format(e)}`)
                }
            } else if (isCmd) {
                m_.reply(`الأمر *${command}* غير موجود.`)
            }
        }
        
        // ============================================================
        // 5. معالجة الرسائل غير الأوامر (Anti-Link, AFK, Simi)
        // ============================================================
        
        // نظام AFK
        if (global.db.data.users[m_.sender].afk > -1) {
            m_.reply(`مرحباً بك مجدداً يا ${m_.sender.split('@')[0]}! لقد كنت في وضع AFK لمدة ${new Date() - global.db.data.users[m_.sender].afk}ms.`)
            global.db.data.users[m_.sender].afk = -1
            global.db.data.users[m_.sender].afkReason = ''
        }
        
        if (m_.mentionedJid.length > 0) {
            for (let jid of m_.mentionedJid) {
                let user = global.db.data.users[jid]
                if (user && user.afk > -1) {
                    m_.reply(`المستخدم @${jid.split('@')[0]} في وضع AFK.\nالسبب: ${user.afkReason || 'لا يوجد سبب'}\nمنذ: ${new Date(user.afk).toLocaleString()}`)
                }
            }
        }
        
        // نظام Anti-Link
        if (m_.isGroup && global.db.data.chats[m_.chat].antiLink && /(https?:\/\/[^\s]+)/g.test(m_.text)) {
            // تحقق من صلاحيات البوت والمسؤولين
            // إذا كان الرابط ليس من مسؤول المجموعة، قم بحذف الرسالة وإرسال تحذير
        }
        
        // نظام Simi (إذا كان مفعلاً)
        if (m_.isGroup && global.db.data.chats[m_.chat].simi && !isCmd) {
            // تنفيذ وظيفة Simi
        }
        
        // ============================================================
        // 6. معالجة رسائل الجلسات المتعددة (Jadibot)
        // ============================================================
        // يجب أن يتم التعامل مع رسائل الجلسات المتعددة هنا
        
    }
}

// ============================================================
// 7. وظيفة تحميل الملحقات (Plugins)
// ============================================================
global.reloadPlugins = async function () {
    global.plugins = {}
    readPlugins()
}

// ============================================================
// 8. مراقبة ملفات الملحقات (Hot-Reloading)
// ============================================================
const pluginFolder = join(__dirname, 'plugins')
if (!fs.existsSync(pluginFolder)) {
    fs.mkdirSync(pluginFolder)
}

// Watch for changes in plugins folder
function watchPlugins() {
    const files = fs.readdirSync(pluginFolder)
    for (const file of files) {
        const filePath = join(pluginFolder, file)
        watchFile(filePath, () => {
            unwatchFile(filePath)
            console.log(chalk.redBright(`\nUpdate: ${filePath}`))
            global.reloadPlugins()
            watchPlugins() // Re-watch after reload
        })
    }
}
watchPlugins()

// ============================================================
// 9. وظيفة التحقق من صلاحيات المسؤول (Placeholder)
// ============================================================
// يجب أن يتم استبدال هذا بآلية تحقق حقيقية من Baileys
global.db.data.chats[m_.chat].isAdmin = false // Placeholder

// ============================================================
// 10. تصدير المعالج
// ============================================================
export { handler }
