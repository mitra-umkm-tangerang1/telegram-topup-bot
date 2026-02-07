// lib/order.js
import prices from "./price.js";
import { sendWA } from "./wa.js";

const sessions = {};

// format rupiah FIX (tanpa pembagian 1000)
const formatRupiah = (num) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(Number(num));

/**
 * STEP 1 — Mulai order
 */
function startOrder(userId, game) {
  sessions[userId] = {
    step: "INPUT_ID",
    status: "INPUT",
    game: game,
    gameId: "",
    server: "",
    product: null
  };

  return {
    text: "🎮 Masukkan ID Game kamu:"
  };
}

/**
 * HANDLE INPUT TEXT
 */
function handleText(userId, text) {
  const session = sessions[userId];
  if (!session) return null;

  // INPUT ID
  if (session.step === "INPUT_ID") {
    session.gameId = text;
    session.step = "INPUT_SERVER";

    return {
      text: "🖥️ Masukkan Server (contoh: 1234):"
    };
  }

  // INPUT SERVER → PILIH NOMINAL
  if (session.step === "INPUT_SERVER") {
    session.server = text;
    session.step = "PICK_PRODUCT";

    const buttons = prices[session.game].map((item, i) => ([
      {
        text: `${item.name} — ${formatRupiah(item.price)}`,
        callback_data: `PICK_${i}`
      }
    ]));

    return {
      text: "💰 Pilih Nominal:",
      options: {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    };
  }

  // Jika user kirim teks saat nunggu pembayaran
  if (session.step === "WAIT_PAYMENT") {
    return {
      text: "📸 Silakan upload FOTO bukti transfer (bukan teks)."
    };
  }

  return null;
}

/**
 * HANDLE CALLBACK
 */
async function handleCallback(userId, data) {
  const session = sessions[userId];
  if (!session) return null;

  // PILIH PRODUK
  if (session.step === "PICK_PRODUCT" && data.startsWith("PICK_")) {
    const index = Number(data.replace("PICK_", ""));
    const product = prices[session.game][index];

    if (!product) {
      return { text: "❌ Produk tidak valid" };
    }

    session.product = product;
    session.step = "CONFIRM";

    return {
      text:
`🧾 Konfirmasi Order

🎮 Game: ${session.game}
🆔 ID: ${session.gameId}
🖥️ Server: ${session.server}
💎 Produk: ${product.name}
💰 Harga: ${formatRupiah(product.price)}

Lanjutkan?`,
      options: {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Konfirmasi", callback_data: "CONFIRM_ORDER" }],
            [{ text: "❌ Batal", callback_data: "CANCEL_ORDER" }]
          ]
        }
      }
    };
  }

  // KONFIRMASI + KIRIM NOTIF WHATSAPP ADMIN
  if (data === "CONFIRM_ORDER" && session.step === "CONFIRM") {
    session.step = "WAIT_PAYMENT";
    session.status = "WAIT_PAYMENT";

    // kirim notifikasi ke WhatsApp admin
    await sendWA(`ORDER MASUK

Game: ${session.game}
ID: ${session.gameId}
Server: ${session.server}
Produk: ${session.product.name}
Harga: ${formatRupiah(session.product.price)}`);

    return {
      confirm: true,
      order: session
    };
  }

  // BATAL
  if (data === "CANCEL_ORDER") {
    delete sessions[userId];
    return {
      text: "❌ Order dibatalkan.\n\nKetik /start untuk mulai lagi."
    };
  }

  return null;
}

/**
 * HELPERS
 */
function getSession(userId) {
  return sessions[userId] || null;
}

function setWaitingPayment(userId) {
  if (sessions[userId]) {
    sessions[userId].step = "WAIT_PAYMENT";
    sessions[userId].status = "WAIT_PAYMENT";
  }
}

function setStatus(userId, status) {
  if (sessions[userId]) {
    sessions[userId].status = status;
  }
}

function clearSession(userId) {
  delete sessions[userId];
}

export {
  startOrder,
  handleText,
  handleCallback,
  getSession,
  setWaitingPayment,
  setStatus,
  clearSession
};