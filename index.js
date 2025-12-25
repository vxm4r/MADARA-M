import './config.js'
import { setupMaster, fork } from 'cluster'
import { watchFile, unwatchFile } from 'fs'
import cfonts from 'cfonts'
import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import * as ws from 'ws'
import fs, { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import yargs from 'yargs'
import { spawn } from 'child_process'
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { tmpdir } from 'os'
import { format } from 'util'
import boxen from 'boxen'
import pino from 'pino'
import path, { join, dirname } from 'path'
import { Boom } from '@hapi/boom'
import { makeWASocket, protoType, serialize } from './lib/simple.js'

const { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = await import('@whiskeysockets/baileys')
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import store from './lib/store.js'

import readline, { createInterface } from 'readline'
import NodeCache from 'node-cache'
import pkg from 'google-libphonenumber'
const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()

const { CONNECTING } = ws
const { chain } = lodash

// ============================================================
// 1. الإعدادات العامة والمسارات
// ============================================================


const require = createRequire(import.meta.url)

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
}; 
global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true))
};
global.__require = function require(dir = import.meta.url) {
    return createRequire(dir)
}
const __dirname = global.__dirname(import.meta.url)

protoType()
serialize()

global.timestamp = { start: new Date }
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[' + global.PREFIX.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&') + ']')

// ============================================================
// 2. نظام قاعدة البيانات (LowDB)
// ============================================================
global.db = new Low(new JSONFile(join(__dirname, global.DATABASE_PATH)), { users: {}, chats: {}, settings: {} })
global.DATABASE = global.db 

global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) => setInterval(async function() {
            if (!global.db.READ) {
                clearInterval(this)
                resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
            }
        }, 1 * 1000))
    }
    if (global.db.data !== null) return
    global.db.READ = true
    await global.db.read().catch(console.error)
    global.db.READ = null
    global.db.data = {
        users: {},
        chats: {},
        settings: {},
        ...(global.db.data || {}),
    }
    global.db.chain = chain(global.db.data)
}
loadDatabase()

// ============================================================
// 3. وظيفة التحقق من رقم الهاتف
// ============================================================
async function isValidPhoneNumber(phoneNumber) {
    try {
        const number = phoneUtil.parseAndKeepRawInput(phoneNumber);
        return phoneUtil.isValidNumber(number);
    } catch (e) {
        return false;
    }
}

// ============================================================
// 4. إعداد الاتصال الرئيسي
// ============================================================
const { state, saveCreds } = await useMultiFileAuthState(global.SESSION_NAME)
const msgRetryCounterCache = new NodeCache()
const { version } = await fetchLatestBaileysVersion();
let phoneNumber = global.BOT_PHONE

const methodCodeQR = process.argv.includes("qr")
const methodCode = !!phoneNumber || process.argv.includes("code")
const MethodMobile = process.argv.includes("mobile")

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))

let opcion
if (methodCodeQR) {
    opcion = '1'
}

if (!methodCodeQR && !methodCode && !fs.existsSync(`./${global.SESSION_NAME}/creds.json`)) {
    do {
        opcion = await question(chalk.bgMagenta.white('⌨ Select an option:\n') + chalk.bold.green('1. With QR Code\n') + chalk.bold.cyan('2. With 8-digit text code\n--> '))
        if (!/^[1-2]$/.test(opcion)) {
            console.log(chalk.bold.redBright(`✦ Invalid option. Please enter 1 or 2.`))
        }
    } while (opcion !== '1' && opcion !== '2' || fs.existsSync(`./${global.SESSION_NAME}/creds.json`))
} 

console.info = () => {} 
console.debug = () => {} 

const connectionOptions = {
    logger: pino({ level: global.DEBUG_MODE ? 'debug' : 'silent' }),
    printQRInTerminal: opcion == '1' ? true : methodCodeQR ? true : false,
    mobile: MethodMobile, 
    browser: [`${global.BOT_NAME}`, 'Edge', '20.0.04'],
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: global.CONNECTION_OPTIONS.markOnlineOnConnect, 
    generateHighQualityLinkPreview: global.CONNECTION_OPTIONS.generateHighQualityLinkPreview, 
    syncFullHistory: global.CONNECTION_OPTIONS.syncFullHistory,
    getMessage: async (clave) => {
        let jid = jidNormalizedUser(clave.remoteJid)
        let msg = await store.loadMessage(jid, clave.id)
        return msg?.message || ""
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
    version,
}

global.conn = makeWASocket(connectionOptions);

if (!fs.existsSync(`./${global.SESSION_NAME}/creds.json`)) {
    if (opcion === '2' || methodCode) {
        opcion = '2'
        if (!global.conn.authState.creds.registered) {
            let addNumber
            if (!!phoneNumber) {
                addNumber = phoneNumber.replace(/[^0-9]/g, '')
            } else {
                do {
                    phoneNumber = await question(chalk.bgBlack(chalk.bold.greenBright(`✦ Please enter WhatsApp number.\n${chalk.bold.yellowBright(`✏  Example: 201005199558`)}\n${chalk.bold.magentaBright('---> ')}`)))
                    phoneNumber = phoneNumber.replace(/\D/g,'')
                    if (!phoneNumber.startsWith('+')) {
                        phoneNumber = `+${phoneNumber}`
                    }
                } while (!await isValidPhoneNumber(phoneNumber))
                rl.close()
                addNumber = phoneNumber.replace(/\D/g, '')
                setTimeout(async () => {
                    let codeBot = await global.conn.requestPairingCode(addNumber)
                    codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot
                    console.log(chalk.bold.white(chalk.bgMagenta(`✧ PAIRING CODE ✧`)), chalk.bold.white(chalk.white(codeBot)))
                }, 3000)
            }
        }
    }
}

global.conn.isInit = false;
global.conn.well = false;

// ============================================================
// 5. وظيفة تحديث الاتصال
// ============================================================
async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin } = update;
    global.stopped = connection;
    if (isNewLogin) global.conn.isInit = true;
    const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
    
    if (code && code !== DisconnectReason.loggedOut && global.conn?.ws.socket == null) {
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date;
    }
    
    if (global.db.data == null) loadDatabase();
    
    if (update.qr != 0 && update.qr != undefined || methodCodeQR) {
        if (opcion == '1' || methodCodeQR) {
            console.log(chalk.bold.yellow(`\n❐ SCAN THE QR CODE, IT EXPIRES IN 45 SECONDS`))
        }
    }
    
    if (connection === 'open') {
        console.log(chalk.green('✅ Connection opened successfully!'))
    }
    
    if (connection === 'close') {
        if (code === DisconnectReason.loggedOut || code === 401) {
            console.log(chalk.red('❌ Logged out. Deleting session and restarting...'))
            try {
                rmSync(`./${global.SESSION_NAME}`, { recursive: true, force: true })
            } catch (e) {
                console.error(chalk.red('❌ Failed to clean session directory:'), e.message);
            }
            process.exit(1)
        } else {
            console.log(chalk.yellow(`🔄 Connection closed. Reason: ${code}. Reconnecting...`))
            await global.reloadHandler(true).catch(console.error)
        }
    }
}

// ============================================================
// 6. نظام المراقبة الحية (Hot-Reloading)
// ============================================================
let handler = await import('./handler.js')
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
        if (Object.keys(Handler || {}).length) handler = Handler
    } catch (e) {
        console.error('⚠️ New error: ', e)
    }
    
    if (restatConn) {
        const oldChats = global.conn.chats
        try { global.conn.ws.close() } catch { }
        global.conn.ev.removeAllListeners()
        global.conn = makeWASocket(connectionOptions, { chats: oldChats })
        global.conn.isInit = true
    }
    

    
    global.conn.handler = handler.handler.bind(global.conn)
    global.conn.connectionUpdate = connectionUpdate.bind(global.conn)
    global.conn.credsUpdate = saveCreds.bind(global.conn, true)
    
    global.conn.ev.on("messages.upsert", global.conn.handler)

    // معالجة رسائل الجلسات المتعددة (Jadibot)
    for (const conn of global.conns) {
        conn.ev.on("messages.upsert", conn.handler)
    }
    global.conn.ev.on("connection.update", global.conn.connectionUpdate)
    global.conn.ev.on("creds.update", global.conn.credsUpdate)

    // تحديث بيانات الجلسات المتعددة
    for (const conn of global.conns) {
        conn.ev.on("connection.update", conn.connectionUpdate)
        conn.ev.on("creds.update", conn.credsUpdate)
    }
    
    global.conn.isInit = false
    return true
}

global.reloadHandler(false)

// ============================================================
// 7. نظام الجلسات المتعددة (Jadibot)
// ============================================================
global.conns = [] // لتخزين اتصالات الجلسات المتعددة

// ============================================================
// 8. وظيفة التحقق من المطورين (محدثة)
// ============================================================
global.isOwner = (jid) => {
    const ownerList = global.owner.map(v => v[0] + '@s.whatsapp.net');
    return ownerList.includes(jid);
}

// ============================================================
// 9. بدء التشغيل
// ============================================================
function start() {
    cfonts.say('SOLO BOT', {
        font: 'simple',
        align: 'left',
        gradient: ['#f12711', '#f5af19']
    })
    cfonts.say('Advanced WhatsApp Bot - Powered By KING', {
        font: 'console',
        align: 'center',
        colors: ['cyan', 'magenta', 'yellow']
    })
    
    // حفظ قاعدة البيانات كل فترة
    if (!global.opts['test']) {
        setInterval(async () => {
            if (global.db.data) await global.db.write()
        }, global.AUTO_SAVE_INTERVAL);
    }
}

start()

// Watch for changes in handler.js and plugins folder
const pluginFolder = join(__dirname, 'plugins')
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
            global.reloadHandler(false)
            watchPlugins() // Re-watch after reload
        })
    }
}
watchPlugins()
// لا تعدل على الملف اتي 
