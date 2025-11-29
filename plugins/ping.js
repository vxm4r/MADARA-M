export default {
    command: ["ping", "بنج", "سرعة"],
    name: "Ping",
    category: "General",
    owner: false,
    handler: async function (m, { conn }) {
        const startTime = Date.now()
        const sentMsg = await conn.sendMessage(m.chat, { text: "جاري الاختبار..." }, { quoted: m })
        const endTime = Date.now()
        const latency = endTime - startTime
        
        await conn.sendMessage(m.chat, { text: `✅ الرد: ${latency} مللي ثانية` }, { quoted: sentMsg })
    }
}
