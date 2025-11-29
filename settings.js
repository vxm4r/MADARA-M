import { fileURLToPath } from 'url'
import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'

global.owner = [
  ['201005199558', 'KING-X-SOLO', true],
  ['201005199558', 'KING-X-SOLO', true]
]

global.mods = []
global.prems = []

global.APIs = {
  // Add your API keys here
}
global.APIKeys = {
  // Add your API keys here
}

global.nameqr = 'SOLO-BOT'
global.botNumber = '201005199558' // رقم البوت
global.Rubysessions = 'session' // اسم مجلد الجلسة
global.jadi = 'jadibot' // اسم مجلد الجلسات المتعددة

global.support = {
  // Add support objects if needed
}

global.ch = {
  // Add channel IDs if needed
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'settings.js'"))
  import(`${file}?update=${Date.now()}`)
})
