// lib/admin.js
const ADMIN_ID = process.env.ADMIN_ID

function notifyAdmin(bot, order, user) {
  const msg = `
🧾 ORDER BARU
Game: ${order.game}
ID: ${order.gameId} (${order.server})
Nominal: ${order.product.name}
Harga: Rp${order.product.price}

User: @${user.username || "noname"}
User ID: ${user.id}
  `
  bot.sendMessage(ADMIN_ID, msg)
}

module.exports = { notifyAdmin }