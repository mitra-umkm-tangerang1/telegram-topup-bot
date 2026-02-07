import axios from "axios";
import fetch from "node-fetch";

import {
  startOrder,
  handleText,
  handleCallback,
  getSession,
  clearSession,
  setStatus,
  setWaitingPayment
} from "../lib/order.js";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "";

// ================= FORMAT RUPIAH =================
const formatRupiah = (number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(number);

// ================= KIRIM WHATSAPP =================
async function sendWA(text) {
  if (!FONNTE_TOKEN) return;
  try {
    await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: FONNTE_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: "6285718539571",
        message: text
      })
    });
  } catch (e) {
    console.log("WA ERROR", e?.message);
  }
}

// ================= PAYMENT INFO =================
const PAYMENT_TEXT = `
💳 *Informasi Pembayaran*

🏦 *BCA*
0750184219
A/N: *ROHMAN BRAMANTO*

📱 *DANA*
085694766782
A/N: *ROHMAN BRAMANTO*

📌 *Catatan penting:*
• Transfer sesuai nominal
• Wajib kirim *FOTO bukti transfer*
• Screenshot / foto jelas
`;

const QRIS_IMAGE_URL =
  "https://telegram-topup-bot-cwgs.vercel.app/qris.jpg";

// =================================================

export default async function handler(req, res) {
  // Endpoint health check
  if (req.method !== "POST") {
    return res.status(200).send("Bot aktif");
  }

  if (!TOKEN) {
    console.error("BOT_TOKEN belum di set");
    return res.status(200).end();
  }

  try {
    // ===== PASTIKAN BODY TERBACA =====
    let update = req.body;
    if (typeof update === "string") {
      update = JSON.parse(update);
    }

    if (!update) {
      return res.status(200).end();
    }

    /* ================= CALLBACK ================= */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const userId = cb.from.id;
      const data = cb.data;

      if (data === "GAME_ML" || data === "GAME_FF") {
        const game = data === "GAME_ML" ? "ML" : "FF";
        const reply = startOrder(userId, game);
        await sendMessage(chatId, reply.text);
        return res.status(200).end();
      }

      const cbResult = handleCallback(userId, data);
      if (cbResult) {
        if (cbResult.confirm) {
          const o = cbResult.order;
          setWaitingPayment(userId);

          await sendMessage(
            chatId,
`✅ *Order dikonfirmasi*

🎮 Game: ${o.game}
🆔 ID: ${o.gameId} (${o.server})
💎 Produk: ${o.product.name}
💰 Harga: *${formatRupiah(o.product.price)}*

${PAYMENT_TEXT}`
          );

          const adminText =
`🛒 ORDER MASUK

Game: ${o.game}
ID: ${o.gameId} (${o.server})
Produk: ${o.product.name}
Harga: ${formatRupiah(o.product.price)}
User ID: ${userId}`;

          if (ADMIN_ID) {
            await sendMessage(ADMIN_ID, adminText);
          }

          await sendWA(adminText);

          await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: QRIS_IMAGE_URL,
            caption:
`📷 *QRIS Pembayaran*
Scan QRIS di atas untuk bayar

📸 Setelah bayar, *kirim FOTO bukti transfer di chat ini*`,
            
          });
        } else {
          await sendMessage(chatId, cbResult.text, cbResult.options);
        }

        return res.status(200).end();
      }

      if (data.startsWith("ADMIN_")) {
        if (String(userId) !== ADMIN_ID) {
          await sendMessage(chatId, "❌ Akses admin ditolak");
          return res.status(200).end();
        }

        const [, action, targetUserId] = data.split("_");
        const order = getSession(targetUserId);
        if (!order) return res.status(200).end();

        if (action === "APPROVE") {
          setStatus(targetUserId, "APPROVED");
          await sendMessage(
            targetUserId,
            "✅ *Pembayaran diterima*\n⏳ Order sedang diproses"
          );
          await sendMessage(chatId, "✔️ Order di-approve");
        }

        if (action === "REJECT") {
          clearSession(targetUserId);
          await sendMessage(
            targetUserId,
            "❌ *Pembayaran ditolak*\nSilakan order ulang dengan /start"
          );
          await sendMessage(chatId, "❌ Order ditolak");
        }

        if (action === "DONE") {
          clearSession(targetUserId);
          await sendMessage(
            targetUserId,
            "🎉 *Order selesai*\nDiamond sudah masuk 🙏"
          );
          await sendMessage(chatId, "🎮 Order ditandai SELESAI");
        }

        return res.status(200).end();
      }

      return res.status(200).end();
    }

    /* ================= MESSAGE ================= */
    if (!update.message) return res.status(200).end();

    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || "";

    if (text === "/start") {
      await sendMessage(
        chatId,
`👋 *Selamat datang di Bot Top Up Game*

🎮 Pilih game:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🎯 Mobile Legends", callback_data: "GAME_ML" }],
              [{ text: "🔥 Free Fire", callback_data: "GAME_FF" }]
            ]
          }
        }
      );
      return res.status(200).end();
    }

    if (message.photo) {
      const session = getSession(userId);
      if (!session || session.step !== "WAIT_PAYMENT") {
        await sendMessage(chatId, "❌ Tidak ada order aktif\nKetik /start");
        return res.status(200).end();
      }

      const fileId = message.photo.at(-1).file_id;

      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: ADMIN_ID,
        photo: fileId,
        caption:
`🧾 *BUKTI TRANSFER*

🎮 Game: ${session.game}
🆔 ID: ${session.gameId} (${session.server})
💎 Produk: ${session.product.name}
💰 Harga: *${formatRupiah(session.product.price)}*

👤 User ID: ${userId}`,
        
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `ADMIN_APPROVE_${userId}` },
              { text: "❌ Tolak", callback_data: `ADMIN_REJECT_${userId}` }
            ],
            [{ text: "🎮 Selesai", callback_data: `ADMIN_DONE_${userId}` }]
          ]
        }
      });

      session.step = "WAIT_ADMIN";
      await sendMessage(chatId, "⏳ Bukti diterima\nMenunggu konfirmasi admin 🙏");
      return res.status(200).end();
    }

    const textResult = handleText(userId, text);
    if (textResult) {
      await sendMessage(chatId, textResult.text, textResult.options);
    }

    return res.status(200).end();
  } catch (err) {
    console.error("BOT ERROR:", err?.message);
    return res.status(200).end();
  }
}

async function sendMessage(chatId, text, options = {}) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    
    ...options
  });
}