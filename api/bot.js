import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot aktif");
  }

  const message = req.body.message;
  if (!message) return res.status(200).end();

  const chatId = message.chat.id;
  const text = message.text || "";

  if (text === "/start") {
    await sendMessage(chatId, 
`👋 Selamat datang di Bot Top Up Game!

🎮 Game tersedia:
1️⃣ Mobile Legends
2️⃣ Free Fire

⏱ Proses cepat | 💳 Pembayaran manual
Ketik angka pilihan kamu`);
  }

  res.status(200).end();
}

async function sendMessage(chatId, text) {
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text
  });
}