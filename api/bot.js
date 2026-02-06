import axios from "axios";
import { startOrder, handleOrder } from "../lib/order.js";
import { notifyAdmin } from "../lib/admin.js";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot aktif");
  }

  const message = req.body.message;
  if (!message) return res.status(200).end();

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || "";

  // ===== /START =====
  if (text === "/start") {
    await sendMessage(
      chatId,
`👋 Selamat datang di Bot Top Up Game!

🎮 Game tersedia:
1️⃣ Mobile Legends
2️⃣ Free Fire

⏱ Proses cepat | 💳 Pembayaran manual
Ketik angka pilihan kamu`
    );
    return res.status(200).end();
  }

  // ===== PILIH GAME =====
  if (text === "1") {
    const reply = startOrder(userId, "ML");
    await sendMessage(chatId, reply);
    return res.status(200).end();
  }

  if (text === "2") {
    const reply = startOrder(userId, "FF");
    await sendMessage(chatId, reply);
    return res.status(200).end();
  }

  // ===== PROSES ORDER =====
  const result = handleOrder(userId, text);
  if (!result) return res.status(200).end();

  // Jika order selesai
  if (result.done) {
    const order = result.order;

    await sendMessage(
      chatId,
`✅ Order diterima

🎮 Game: ${order.game}
🆔 ID: ${order.gameId} (${order.server})
💎 Nominal: ${order.product.name}
💰 Harga: Rp${order.product.price}

Silakan transfer & kirim bukti pembayaran.`
    );

    // Kirim notif ke admin
    await notifyAdminAxios(order, message.from);

    return res.status(200).end();
  }

  // Jika masih proses step
  await sendMessage(chatId, result);
  return res.status(200).end();
}

// ===== HELPER =====
async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text
  });
}

// ===== NOTIF ADMIN (AXIOS VERSION) =====
async function notifyAdminAxios(order, user) {
  const ADMIN_ID = process.env.ADMIN_ID;

  const msg = `
🧾 ORDER BARU
🎮 Game: ${order.game}
🆔 ID: ${order.gameId} (${order.server})
💎 Nominal: ${order.product.name}
💰 Harga: Rp${order.product.price}

👤 User: @${user.username || "noname"}
🆔 User ID: ${user.id}
  `;

  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: ADMIN_ID,
    text: msg
  });
}