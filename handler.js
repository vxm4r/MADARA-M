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
        let sender = m_.isGroup ? (m_.key.participant ? m_.key.participant : m_.sender) : m_.key.remoteJid;
        const isNumber = x => typeof x === 'number' && !isNaN(x)
        
        try {
            m_.exp = 0
            m_.coin = false
            
            let user = global.db.data.users[sender];
            if (typeof user !== 'object') global.db.data.users[sender] = {};
            if (user) {
                Object.assign(user, {
                    exp: isNumber(user.exp) ? user.exp : 0,
                    coin: isNumber(user.coin) ? user.coin : 10,
                    bank: isNumber(user.bank) ? user.bank : 0,
                    joincount: isNumber(user.joincount) ? user.joincount : 1,
                    diamond: isNumber(user.diamond) ? user.diamond : 3,
                    emerald: isNumber(user.emerald) ? user.emerald : 0, 
                    iron: isNumber(user.iron) ? user.iron : 0, 
                    gold: isNumber(user.gold) ? user.gold : 0, 
                    coal: isNumber(user.coal) ? user.coal : 0, 
                    stone: isNumber(user.stone) ? user.stone : 0, 
                    candies: isNumber(user.candies) ? user.candies : 0, 
                    gifts: isNumber(user.gifts) ? user.gifts : 0, 
                    lastadventure: isNumber(user.lastadventure) ? user.lastadventure : 0,
                    lastclaim: isNumber(user.lastclaim) ? user.lastclaim : 0,
                    health: isNumber(user.health) ? user.health : 100,
                    crime: isNumber(user.crime) ? user.crime : 0,
                    lastcofre: isNumber(user.lastcofre) ? user.lastcofre : 0,
                    lastdiamantes: isNumber(user.lastdiamantes) ? user.lastdiamantes : 0,
                    lastpago: isNumber(user.lastpago) ? user.lastpago : 0,
                    lastcode: isNumber(user.lastcode) ? user.lastcode : 0,
                    lastcodereg: isNumber(user.lastcodereg) ? user.lastcodereg : 0,
                    lastduel: isNumber(user.lastduel) ? user.lastduel : 0,
                    lastmining: isNumber(user.lastmining) ? user.lastmining : 0,
                    muto: 'muto' in user ? user.muto : false,
                    premium: 'premium' in user ? user.premium : false,
                    premiumTime: user.premium ? user.premiumTime || 0 : 0,
                    registered: 'registered' in user ? user.registered : false,
                    genre: user.genre || '',
                    birth: user.birth || '',
                    marry: user.marry || '',
                    description: user.description || '',
                    packstickers: user.packstickers || null,
                    name: user.name || m_.name,
                    age: isNumber(user.age) ? user.age : -1,
                    regTime: isNumber(user.regTime) ? user.regTime : -1,
                    afk: isNumber(user.afk) ? user.afk : -1,
                    afkReason: user.afkReason || '',
                    role: user.role || 'Nuv',
                    banned: 'banned' in user ? user.banned : false,
                    useDocument: 'useDocument' in user ? user.useDocument : false,
                    level: isNumber(user.level) ? user.level : 0,
                    warn: isNumber(user.warn) ? user.warn : 0,
                    
                    equipment: user.equipment || {
                        weapon: 'none',
                        armor: 'none',
                        tool: 'none',
                        weapon_durability: isNumber(user.equipment?.weapon_durability) ? user.equipment.weapon_durability : 0,
                        armor_durability: isNumber(user.equipment?.armor_durability) ? user.equipment.armor_durability : 0,
                    },
                    inventory: user.inventory || {
                        health_potion: 0,
                        luck_potion: 0,
                        escape_amulet: 0,
                        lockpick: 0,
                        mysterious_chest: 0,
                    },
                    materials: user.materials || {
                        wood: 0,
                        gem: 0,
                        goblin_skin: 0,
                        orc_bone: 0,
                        slime_goo: 0,
                        wolf_fur: 0,
                        harpy_feather: 0,
                        chitin_shell: 0,
                        lich_phylactery: 0
                    },
                    status: user.status || {
                        is_jailed: false,
                        jailed_until: 0,
                        is_lucky: false,
                        lucky_until: 0,
                    },
                });
            } else {
                global.db.data.users[sender] = {
                    exp: 0, coin: 10, bank: 0, joincount: 1, diamond: 3, emerald: 0, iron: 0, gold: 0, coal: 0, stone: 0, candies: 0, gifts: 0, lastadventure: 0, health: 100, lastclaim: 0, lastcofre: 0, lastdiamantes: 0, lastcode: 0, lastduel: 0, lastpago: 0, lastmining: 0, lastcodereg: 0, muto: false, registered: false, genre: '', birth: '', marry: '', description: '', packstickers: null, name: m_.name, age: -1, regTime: -1, afk: -1, afkReason: '', banned: false, useDocument: false, level: 0, role: 'Nuv', premium: false, premiumTime: 0, warn: 0,
                    equipment: { weapon: 'none', armor: 'none', tool: 'none', weapon_durability: 0, armor_durability: 0 },
                    inventory: { health_potion: 0, luck_potion: 0, escape_amulet: 0, lockpick: 0, mysterious_chest: 0 },
                    materials: { wood: 0, gem: 0, goblin_skin: 0, orc_bone: 0, slime_goo: 0, wolf_fur: 0, harpy_feather: 0, chitin_shell: 0, lich_phylactery: 0 },
                    status: { is_jailed: false, jailed_until: 0, is_lucky: false, lucky_until: 0 },
                };
            }
            
            let chat = global.db.data.chats[m_.chat]
            if (typeof chat !== 'object') global.db.data.chats[m_.chat] = {}
            if (chat) {
                if (!('isBanned' in chat)) chat.isBanned = false
                if (!('bannedBots' in chat)) chat.bannedBots = []
                if (!('sAutoresponder' in chat)) chat.sAutoresponder = ''
                if (!('welcome' in chat)) chat.welcome = true
                if (!('welcomeText' in chat)) chat.welcomeText = null
                if (!('byeText' in chat)) chat.byeText = null
                if (!('autolevelup' in chat)) chat.autolevelup = false
                if (!('autoAceptar' in chat)) chat.autoAceptar = false
                if (!('autosticker' in chat)) chat.autosticker = false
                if (!('autoRechazar' in chat)) chat.autoRechazar = false
                if (!('autoresponder' in chat)) chat.autoresponder = false
                if (!('detect' in chat)) chat.detect = true
                if (!('audios' in chat)) chat.audios = false
                if (!('antiBot' in chat)) chat.antiBot = false
                if (!('antiBot2' in chat)) chat.antiBot2 = false
                if (!('modoadmin' in chat)) chat.modoadmin = false
                if (!('antiLink' in chat)) chat.antiLink = true
                if (!('antiImg' in chat)) chat.antiImg = false
                if (!('reaction' in chat)) chat.reaction = false
                if (!('antiArabe' in chat)) chat.antiArabe = false
                if (!('nsfw' in chat)) chat.nsfw = false
                if (!('antifake' in chat)) chat.antifake = false
                if (!('delete' in chat)) chat.delete = false
                if (!isNumber(chat.expired)) chat.expired = 0
                if (!('botPrimario' in chat)) chat.botPrimario = null
            } else {
                global.db.data.chats[m_.chat] = {
                    sAutoresponder: '', welcome: true, isBanned: false, autolevelup: false, autoresponder: false, delete: false, autoAceptar: false, autoRechazar: false, detect: true, antiBot: false,
                    antiBot2: false, modoadmin: false, antiLink: true, antifake: false, antiArabe: false, reaction: false, nsw: false, expired: 0,
                    welcomeText: null, byeText: null, audios: false, botPrimario: null,
                    bannedBots: []
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
        
        // ============================================================
        // 4.1. نظام وضع المطورين (Developer Mode)
        // ============================================================
        const isOwner = global.owner.map(v => v[0] + '@s.whatsapp.net').includes(m_.sender)
        
        if (global.developerMode && !isOwner) {
            // إذا كان وضع المطورين مفعلاً والرسالة ليست من المطور، تجاهلها
            return
        }
        
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
                    // تحقق من الصلاحيات الموسع
                    const groupMetadata = m_.isGroup ? await this.groupMetadata(m_.chat).catch(_ => null) : {}
                    const participants = m_.isGroup ? groupMetadata.participants : []
                    const userGroup = (m_.isGroup ? participants.find((u) => this.decodeJid(u.id) === m_.sender) : {}) || {}
                    const botGroup = (m_.isGroup ? participants.find((u) => this.decodeJid(u.id) == this.user.jid) : {}) || {}
                    
                    const isRAdmin = userGroup?.admin == "superadmin" || false
                    const isAdmin = isRAdmin || userGroup?.admin == "admin" || false
                    const isBotAdmin = botGroup?.admin == "admin" || botGroup?.admin == "superadmin" || false
                    
                    const isPrems = isOwner || global.db.data.users[m_.sender].premium
                    const isGroup = m_.isGroup
                    
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
                    if (plugin.botAdmin && !isBotAdmin) {
                        m_.reply('هذا الأمر يتطلب أن يكون البوت مسؤولاً في المجموعة.')
                        continue
                    }
                    if (global.db.data.users[m_.sender].banned) {
                        m_.reply('أنت محظور من استخدام البوت.')
                        continue
                    }
                    
                    // تنفيذ الأمر
                    await plugin.execute(this, m_, { command, text, isOwner, isPrems, isGroup, isAdmin, isBotAdmin })
                    
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
        // 5. معالجة الرسائل غير الأوامر (All Handler)
        // ============================================================
        
        // تنفيذ وظيفة all لجميع الملحقات
        for (let name in global.plugins) {
            let module = await global.plugins[name]
            if (module.default && typeof module.default.all === 'function') {
                try {
                    await module.default.all.call(this, m_, { isOwner, isPrems, isGroup, isAdmin, isBotAdmin })
                } catch (e) {
                    console.error(chalk.red(`Error executing all function in ${name}:`), e)
                }
            }
        }
        
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
        
        // نظام Anti-Link (يمكن نقله إلى ملف plugin/anti-link.js)
        if (m_.isGroup && global.db.data.chats[m_.chat].antiLink && /(https?:\/\/[^\s]+)/g.test(m_.text)) {
            // تحقق من صلاحيات البوت والمسؤولين
            // إذا كان الرابط ليس من مسؤول المجموعة، قم بحذف الرسالة وإرسال تحذير
        }
        
        // نظام Simi (يمكن نقله إلى ملف plugin/simi.js)
        if (m_.isGroup && global.db.data.chats[m_.chat].simi && !isCmd) {
            // تنفيذ وظيفة Simi
        }
        
        // ============================================================
        // 6. معالجة رسائل الجلسات المتعددة (Jadibot)
        // ============================================================
        // لا حاجة لـ Jadibot هنا، يتم التعامل معها في ملف jadibot-serbot.js
        
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
// تم نقل التحقق من الصلاحيات إلى داخل معالج الأوامر

// ============================================================
// 10. تصدير المعالج
// ============================================================
export { handler }
