import axios from "axios";
import fetch from "node-fetch";
import FormData from "form-data";

import { orderDigiflazz, checkStatus } from "../lib/digiflazz.js";
import { generateInvoicePDF } from "../lib/invoice.js";

import {
  startOrder,
  handleText,
  handleCallback,
  getSession,
  clearSession,
  setStatus
} from "../lib/order.js";


const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const ADMIN_ID = String(process.env.ADMIN_ID || "");
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "";

const QRIS_URL = "https://telegram-topup-bot-cwgs.vercel.app/qris.jpg";

const formatRupiah = (number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(number);

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot aktif");
  }

  if (!TOKEN) {
    console.error("BOT_TOKEN belum diset");
    return res.status(200).end();
  }

  try {
    let update = req.body;
    if (typeof update === "string") update = JSON.parse(update);
    if (!update) return res.status(200).end();

    /* ================= CALLBACK ================= */
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const userId = cb.from.id;
      const data = cb.data;

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: cb.id
      });

      const cbResult = await handleCallback(userId, data);

      if (cbResult) {
        if (cbResult.confirm) {
          const o = cbResult.order;

          await sendMessage(
            chatId,
`✅ *Order dikonfirmasi*

📦 Produk: ${o.product.product_name}
💰 Harga: *${formatRupiah(o.product.sell_price)}*

💳 Silakan bayar via QRIS di bawah ini.
Setelah bayar kirim *FOTO bukti transfer*.`
          );

          await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: chatId,
            photo: QRIS_URL,
            caption: `📷 *QRIS Pembayaran*

Nominal: ${formatRupiah(o.product.sell_price)}

Scan & bayar sesuai nominal.`,
            parse_mode: "Markdown"
          });

          await sendWA(`ORDER MASUK

Produk: ${o.product.product_name}
Harga: ${formatRupiah(o.product.sell_price)}
User ID: ${userId}`);

          return res.status(200).end();
        }

        await sendMessage(chatId, cbResult.text, cbResult.options);
        return res.status(200).end();
      }

      /* ================= ADMIN ================= */
      if (data.startsWith("ADMIN_")) {
        if (String(userId) !== ADMIN_ID) {
          await sendMessage(chatId, "❌ Akses admin ditolak");
          return res.status(200).end();
        }

        const [, action, targetUserId] = data.split("_");
        const order = getSession(targetUserId);
        if (!order) return res.status(200).end();

        if (action === "APPROVE") {
          setStatus(targetUserId, "PROCESSING");

          await sendMessage(
            targetUserId,
            "⏳ Pembayaran diterima\nMemproses ke server..."
          );

          const refId = "INV" + Date.now();

          const trx = await orderDigiflazz(
            refId,
            order.product.buyer_sku_code,
            order.customerNo
          );

          if (!trx?.data) {
            await sendMessage(targetUserId, "❌ Gagal kirim ke server");
            return res.status(200).end();
          }

          let finalStatus = trx.data.status;
          let sn = trx.data.sn || "";

          for (let i = 0; i < 6; i++) {
            if (finalStatus === "Sukses") break;
            await new Promise(r => setTimeout(r, 5000));
            const check = await checkStatus(refId);
            finalStatus = check?.data?.status;
            sn = check?.data?.sn || "";
          }

          if (finalStatus === "Sukses") {
            const pdfBuffer = await generateInvoicePDF({
              invoice: refId,
              product: order.product.product_name,
              price: formatRupiah(order.product.sell_price),
              target: order.customerNo,
              sn
            });

            const form = new FormData();
            form.append("chat_id", targetUserId);
            form.append("document", pdfBuffer, {
              filename: "invoice.pdf",
              contentType: "application/pdf"
            });
            form.append(
              "caption",
              `✅ *TRANSAKSI BERHASIL*

Invoice: ${refId}

SN:
\`${sn}\``
            );
            form.append("parse_mode", "Markdown");

            await axios.post(`${TELEGRAM_API}/sendDocument`, form, {
              headers: form.getHeaders()
            });

            await sendMessage(chatId, "✅ Transaksi sukses");
            clearSession(targetUserId);
          } else {
            await sendMessage(
              targetUserId,
              `❌ Transaksi gagal\nStatus: ${finalStatus}`
            );
            await sendMessage(chatId, "❌ Transaksi gagal");
          }
        }

        if (action === "REJECT") {
          clearSession(targetUserId);
          await sendMessage(
            targetUserId,
            "❌ Pembayaran ditolak\nSilakan order ulang."
          );
          await sendMessage(chatId, "❌ Order ditolak");
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
      const start = await startOrder(userId);
      await sendMessage(chatId, start.text, start.options);
      return res.status(200).end();
    }

    if (message.photo) {
      const session = getSession(userId);
      if (!session) return res.status(200).end();

      const fileId = message.photo.at(-1).file_id;

      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: ADMIN_ID,
        photo: fileId,
        caption:
`🧾 Bukti transfer

Produk: ${session.product.product_name}
User ID: ${userId}`,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `ADMIN_APPROVE_${userId}` },
              { text: "❌ Tolak", callback_data: `ADMIN_REJECT_${userId}` }
            ]
          ]
        }
      });

      await sendMessage(chatId, "⏳ Menunggu konfirmasi admin");
    }

    const textResult = await handleText(userId, text);
    if (textResult) {
      await sendMessage(chatId, textResult.text, textResult.options);
    }

    return res.status(200).end();
  } catch (err) {
    console.error("BOT ERROR:", err);
    return res.status(200).end();
  }
}

async function sendMessage(chatId, text, options = {}) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    ...options
  });
}
