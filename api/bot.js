import axios from "axios";
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
const ADMIN_ID = String(process.env.ADMIN_ID);

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(200).send("Bot aktif");
    }

    const update = req.body;

    /* ================= CALLBACK QUERY ================= */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const userId = cb.from.id;
      const data = cb.data;

      // === PILIH GAME ===
      if (data === "GAME_ML" || data === "GAME_FF") {
        const game = data === "GAME_ML" ? "ML" : "FF";
        const reply = startOrder(userId, game);
        await sendMessage(chatId, reply.text);
        return res.status(200).end();
      }

      // === CALLBACK ORDER ===
      const cbResult = handleCallback(userId, data);
      if (cbResult) {
        if (cbResult.confirm) {
          setWaitingPayment(userId);
          await sendMessage(
            chatId,
`✅ *Order dikonfirmasi*

💰 Silakan transfer sesuai nominal
📸 Upload *FOTO bukti transfer*

⚠️ Wajib foto, bukan teks`
          );
        } else {
          await sendMessage(chatId, cbResult.text, cbResult.options);
        }
        return res.status(200).end();
      }

      // === ADMIN PANEL ===
      if (data.startsWith("ADMIN_")) {
        if (String(userId) !== ADMIN_ID) {
          await sendMessage(chatId, "❌ Akses admin ditolak");
          return res.status(200).end();
        }

        const [_, action, targetUserId] = data.split("_");
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
            "❌ *Pembayaran ditolak*\nSilakan order ulang"
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

    // === /START ===
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

    // === UPLOAD BUKTI TRANSFER ===
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
💎 Nominal: ${session.product.name}
💰 Harga: Rp${session.product.price}

👤 User ID: ${userId}`,
        parse_mode: "Markdown",
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

    // === INPUT ID / SERVER ===
    const textResult = handleText(userId, text);
    if (textResult) {
      await sendMessage(chatId, textResult.text, textResult.options);
    }

    return res.status(200).end();
  } catch (err) {
    console.error("BOT ERROR:", err);
    return res.status(200).end(); // WAJIB 200 agar webhook tidak mati
  }
}

/* ================= HELPER ================= */
async function sendMessage(chatId, text, options = {}) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...options
  });
}