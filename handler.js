import { smsg, protoType } from './lib/simple.js'
import * as economy from './lib/economy.js'
import { fileURLToPath, pathToFileURL } from 'url'
import { watchFile, unwatchFile } from 'fs'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { join } from 'path'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { tmpdir } from 'os'
import { format } from 'util'
import { spawn } from 'child_process'
import fs from 'fs'
import printLog from './lib/print.js' // استيراد نظام المراقبة المتقدم

const __dirname = global.__dirname(import.meta.url)

// ============================================================
// 1. تحميل الملحقات (Plugins)
// ============================================================
global.plugins = {}
const pluginFolder = join(__dirname, 'plugins')

async function readPlugins() {
    global.plugins = {}
    let files = fs.readdirSync(pluginFolder)
    for (let file of files) {
        if (file.endsWith('.js')) {
            try {
                const modulePath = pathToFileURL(join(pluginFolder, file)).href + `?update=${Date.now()}`
                const module = await import(modulePath)
                if (module.default && module.default.command) {
                    global.plugins[file] = module.default
                }
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
        // 3. نظام المراقبة المتقدم (Print Log)
        // ============================================================
        printLog(m_, this).catch(e => console.error(chalk.red('Error in printLog:'), e))

        // ============================================================
        // 4. تحديث قاعدة البيانات (Users/Chats)
        // ============================================================
        let sender = m_.isGroup ? (m_.key.participant ? m_.key.participant : m_.sender) : m_.key.remoteJid;
        const isNumber = x => typeof x === 'number' && !isNaN(x)
        
        try {
            m_.exp = 0
            m_.coin = false
            
            let user = global.db.data.users[sender];
            if (typeof user !== 'object') global.db.data.users[sender] = {};
            if (user) {
                // دمج جميع حقول المستخدم من الأكواد المرفقة
                Object.assign(user, {
                    exp: isNumber(user.exp) ? user.exp : 0,
                    coin: isNumber(user.coin) ? user.coin : 10,
                    bank: isNumber(user.bank) ? user.bank : 0,
                    diamond: isNumber(user.diamond) ? user.diamond : 3,
                    level: isNumber(user.level) ? user.level : 0,
                    health: isNumber(user.health) ? user.health : 100,
                    lastclaim: isNumber(user.lastclaim) ? user.lastclaim : 0,
                    lastadventure: isNumber(user.lastadventure) ? user.lastadventure : 0,
                    lastmining: isNumber(user.lastmining) ? user.lastmining : 0,
                    lastduel: isNumber(user.lastduel) ? user.lastduel : 0,
                    registered: 'registered' in user ? user.registered : false,
                    name: user.name || m_.name,
                    age: isNumber(user.age) ? user.age : -1,
                    regTime: isNumber(user.regTime) ? user.regTime : -1,
                    warn: isNumber(user.warn) ? user.warn : 0,
                    banned: 'banned' in user ? user.banned : false,
                    premium: 'premium' in user ? user.premium : false,
                    premiumTime: user.premium ? user.premiumTime || 0 : 0,
                    role: user.role || 'Nuv',
                    afk: isNumber(user.afk) ? user.afk : -1,
                    afkReason: user.afkReason || '',
                    genre: user.genre || '',
                    birth: user.birth || '',
                    marry: user.marry || '',
                    description: user.description || '',
                    packstickers: user.packstickers || null,
                    muto: 'muto' in user ? user.muto : false,
                    useDocument: 'useDocument' in user ? user.useDocument : false,
                    chocolates: isNumber(user.chocolates) ? user.chocolates : 0, // من الكود المرفق 2
                    usedcommands: isNumber(user.usedcommands) ? user.usedcommands : 0, // من الكود المرفق 2
                    // إضافة حقول الاقتصاد المتقدمة من الكود المرفق 5
                    berlian: isNumber(user.berlian) ? user.berlian : 10,
                    emas: isNumber(user.emas) ? user.emas : 0,
                    emasbatang: isNumber(user.emasbatang) ? user.emasbatang : 0,
                    ruby: isNumber(user.ruby) ? user.ruby : 0,
                    sword: isNumber(user.sword) ? user.sword : 0,
                    sworddurability: isNumber(user.sworddurability) ? user.sworddurability : 0,
                    armor: isNumber(user.armor) ? user.armor : 0,
                    armordurability: isNumber(user.armordurability) ? user.armordurability : 0,
                    pickaxe: isNumber(user.pickaxe) ? user.pickaxe : 0,
                    pickaxedurability: isNumber(user.pickaxedurability) ? user.pickaxedurability : 0,
                    lastfight: isNumber(user.lastfight) ? user.lastfight : 0,
                    lastfishing: isNumber(user.lastfishing) ? user.lastfishing : 0,
                    lasthunt: isNumber(user.lasthunt) ? user.lasthunt : 0,
                    // دمج حقول المخزون والمعدات من الكود الأصلي
                    equipment: user.equipment || { weapon: 'none', armor: 'none', tool: 'none', weapon_durability: 0, armor_durability: 0 },
                    inventory: user.inventory || { health_potion: 0, luck_potion: 0, escape_amulet: 0, lockpick: 0, mysterious_chest: 0 },
                    materials: user.materials || { wood: 0, gem: 0, goblin_skin: 0, orc_bone: 0, slime_goo: 0, wolf_fur: 0, harpy_feather: 0, chitin_shell: 0, lich_phylactery: 0 },
                    status: user.status || { is_jailed: false, jailed_until: 0, is_lucky: false, lucky_until: 0 },
                });
            } else {
                // إنشاء مستخدم جديد بجميع الحقول الافتراضية
                global.db.data.users[sender] = {
                    exp: 0, coin: 10, bank: 0, diamond: 3, level: 0, health: 100, lastclaim: 0, lastadventure: 0, lastmining: 0, lastduel: 0, registered: false, name: m_.name, age: -1, regTime: -1, warn: 0, banned: false, premium: false, premiumTime: 0, role: 'Nuv', afk: -1, afkReason: '', genre: '', birth: '', marry: '', description: '', packstickers: null, muto: false, useDocument: false, chocolates: 0, usedcommands: 0,
                    berlian: 10, emas: 0, emasbatang: 0, ruby: 0, sword: 0, sworddurability: 0, armor: 0, armordurability: 0, pickaxe: 0, pickaxedurability: 0, lastfight: 0, lastfishing: 0, lasthunt: 0,
                    equipment: { weapon: 'none', armor: 'none', tool: 'none', weapon_durability: 0, armor_durability: 0 },
                    inventory: { health_potion: 0, luck_potion: 0, escape_amulet: 0, lockpick: 0, mysterious_chest: 0 },
                    materials: { wood: 0, gem: 0, goblin_skin: 0, orc_bone: 0, slime_goo: 0, wolf_fur: 0, harpy_feather: 0, chitin_shell: 0, lich_phylactery: 0 },
                    status: { is_jailed: false, jailed_until: 0, is_lucky: false, lucky_until: 0 },
                };
            }
            
            let chat = global.db.data.chats[m_.chat]
            if (typeof chat !== 'object') global.db.data.chats[m_.chat] = {}
            if (chat) {
                // دمج جميع حقول الدردشة من الأكواد المرفقة
                if (!('isBanned' in chat)) chat.isBanned = false
                if (!('welcome' in chat)) chat.welcome = global.FEATURES.WELCOME_MESSAGE
                if (!('autolevelup' in chat)) chat.autolevelup = global.FEATURES.AUTO_LEVELUP
                if (!('antiLink' in chat)) chat.antiLink = global.FEATURES.ANTI_LINK
                if (!('reaction' in chat)) chat.reaction = global.FEATURES.REACTION_SYSTEM
                if (!('nsfw' in chat)) chat.nsfw = false
                if (!('detect' in chat)) chat.detect = true
                if (!('adminonly' in chat)) chat.adminonly = false // من الكود المرفق 2
                if (!('antilinks' in chat)) chat.antilinks = true // من الكود المرفق 2
                if (!('bannedGrupo' in chat)) chat.bannedGrupo = false // من الكود المرفق 2
                if (!('primaryBot' in chat)) chat.primaryBot = null // من الكود المرفق 2
                if (!('antiBot' in chat)) chat.antiBot = false
                if (!('antiBot2' in chat)) chat.antiBot2 = false
                if (!('modoadmin' in chat)) chat.modoadmin = false
                if (!('antifake' in chat)) chat.antifake = false
                if (!('delete' in chat)) chat.delete = false
                if (!isNumber(chat.expired)) chat.expired = 0
                if (!('sWelcome' in chat)) chat.sWelcome = ''
                if (!('sBye' in chat)) chat.sBye = ''
                if (!('alerts' in chat)) chat.alerts = true
                if (!('antiLag' in chat)) chat.antiLag = false // من الكود المرفق 5
                if (!('antiTraba' in chat)) chat.antiTraba = true // من الكود المرفق 5
                if (!('viewonce' in chat)) chat.viewonce = false // من الكود المرفق 5
                if (!('antitoxic' in chat)) chat.antitoxic = true // من الكود المرفق 5
                
            } else {
                // إنشاء إعدادات دردشة جديدة بجميع الحقول الافتراضية
                global.db.data.chats[m_.chat] = {
                    isBanned: false, welcome: global.FEATURES.WELCOME_MESSAGE, autolevelup: global.FEATURES.AUTO_LEVELUP, antiLink: global.FEATURES.ANTI_LINK, reaction: global.FEATURES.REACTION_SYSTEM, nsfw: false, detect: true, adminonly: false, antilinks: true, bannedGrupo: false, primaryBot: null, antiBot: false, antiBot2: false, modoadmin: false, antifake: false, delete: false, expired: 0, sWelcome: '', sBye: '', alerts: true, antiLag: false, antiTraba: true, viewonce: false, antitoxic: true
                }
            }
            
            // تحديث آخر رسالة للمستخدم
            user.lastseen = Date.now()
            chat.lastmsg = Date.now()
            
        } catch (e) {
            console.error(chalk.red('Error updating database:'), e)
        }
        
        // ============================================================
        // 5.0. نظام الرد التلقائي (Auto-Reply System)
// ============================================================

// 5.0.1. الرد التلقائي في الخاص (DM)
const isDM = !m_.isGroup;
if (isDM && global.AUTO_REPLY_DM) {
    // التحقق من أن الرسالة ليست أمراً لتجنب التكرار
    if (!isCmd) {
        this.sendMessage(m_.chat, { text: '🤖 مرحباً! أنا بوت واتساب متقدم. يرجى استخدام الأوامر المتاحة. إذا كنت بحاجة للمساعدة، أرسل الأمر: .menu' }, { quoted: m_ });
        return; // إيقاف المعالجة
    }
}

// 5.0.2. الرد التلقائي على الإشارات في المجموعات (Mentions)
// التحقق من أن البوت تمت الإشارة إليه وأن الرد التلقائي على الإشارات مفعل
const isMention = m_.mentionedJid.includes(this.user.jid); 
if (m_.isGroup && global.AUTO_REPLY_MENTION && isMention) {
    // التحقق من أن الرسالة ليست أمراً لتجنب التكرار
    if (!isCmd) {
        this.sendMessage(m_.chat, { text: '👋 تم الإشارة إليّ في المجموعة! يرجى استخدام الأوامر المتاحة. إذا كنت بحاجة للمساعدة، أرسل الأمر: .menu' }, { quoted: m_ });
        return; // إيقاف المعالجة
    }
}

// 5. معالجة الأوامر (Command Processing)
        // ============================================================
        const isCmd = m_.text.startsWith(global.prefix)
        const command = isCmd ? m_.text.slice(global.prefix.length).trim().split(' ')[0].toLowerCase() : ''
        const text = m_.text.slice(global.prefix.length + command.length).trim()
        
        // ============================================================
        // 5.1. نظام وضع المطورين (Developer Mode)
        // ============================================================
        const isOwner = global.owner.map(v => v[0] + '@s.whatsapp.net').includes(m_.sender)
        
        if (global.DEVELOPER_MODE && !isOwner) {
            // إذا كان وضع المطورين مفعلاً والرسالة ليست من المطور، تجاهلها
            return
        }
        
        if (isCmd) {
            let plugin = global.plugins[command]
            if (!plugin) {
                // البحث عن الأمر في جميع الملحقات
                for (const name in global.plugins) {
                    const mod = global.plugins[name]
                    const commands = Array.isArray(mod.command) ? mod.command : [mod.command]
                    if (commands.some(cmd => cmd === command)) {
                        plugin = mod
                        break
                    }
                }
            }
            
            if (plugin) {
                try {
                    // التحقق من الصلاحيات
                    if (plugin.owner && !isOwner) {
                        m_.reply('هذا الأمر مخصص للمطورين فقط.')
                        continue
                    }
                    
                    // تنفيذ الأمر
                    await plugin.handler.call(this, m_, {
                        conn: this,
                        command,
                        text,
                        args: text.split(' ').filter(v => v),
                        isOwner,
                        // إضافة المزيد من المتغيرات المساعدة هنا
                    })
                    
                    // تحديث إحصائيات المستخدم
                    if (user) {
                        user.usedcommands = (user.usedcommands || 0) + 1
                    }
                    
                } catch (e) {
                    console.error(chalk.red(`Error executing command ${command} in ${plugin.name}:`), e)
                    m_.reply('حدث خطأ أثناء تنفيذ الأمر.')
                }
            } else {
                // الأمر غير موجود
                // m_.reply('عفواً، هذا الأمر غير موجود.')
            }
        }
    }
}

// ============================================================
// 6. نظام المراقبة الحية (Hot-Reloading) للملفات
// ============================================================
const handlerFile = join(__dirname, 'handler.js')

watchFile(handlerFile, () => {
    unwatchFile(handlerFile)
    console.log(chalk.redBright(`\nUpdate: ${handlerFile}`))
    global.reloadHandler(false)
})

function watchPlugins() {
    const files = fs.readdirSync(pluginFolder)
    for (const file of files) {
        const filePath = join(pluginFolder, file)
        watchFile(filePath, () => {
            unwatchFile(filePath)
            console.log(chalk.redBright(`\nUpdate: ${filePath}`))
            readPlugins() // إعادة تحميل الملحقات فقط
        })
    }
}
watchPlugins()

//لا تعدل على الملف 
