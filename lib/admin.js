// lib/admin.js
const ADMIN_ID = process.env.ADMIN_ID;

// helper format rupiah
const formatRupiah = (num) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(num);

function notifyAdmin(bot, order, user) {
  const msg = `
🧾 *ORDER BARU*

🎮 Game: ${order.game}
🆔 ID: ${order.gameId} (${order.server})
💎 Nominal: ${order.product.name}
💰 Harga: ${formatRupiah(order.product.price)}

👤 User: @${user.username || "noname"}
🆔 User ID: ${user.id}
  `;

  bot.sendMessage(ADMIN_ID, msg, { parse_mode: "Markdown" });
}

module.exports = { notifyAdmin };