// lib/order.js
const prices = require("./price");

const sessions = {};

/**
 * STEP 1 — Mulai order setelah pilih game
 */
function startOrder(userId, game) {
  sessions[userId] = {
    step: "INPUT_ID",
    status: "INPUT",
    game,
    gameId: "",
    server: "",
    product: null
  };

  return {
    text: "🎮 *Masukkan ID Game kamu:*"
  };
}

/**
 * HANDLE INPUT TEXT USER
 */
function handleText(userId, text) {
  const session = sessions[userId];
  if (!session) return null;

  // === INPUT ID GAME ===
  if (session.step === "INPUT_ID") {
    session.gameId = text;
    session.step = "INPUT_SERVER";

    return {
      text: "🖥️ *Masukkan Server* (contoh: 1234):"
    };
  }

  // === INPUT SERVER → PILIH NOMINAL ===
  if (session.step === "INPUT_SERVER") {
    session.server = text;
    session.step = "PICK_PRODUCT";

    const buttons = prices[session.game].map((p, i) => ([
      {
        text: `${p.name} — Rp${p.price}`,
        callback_data: `PICK_${i}`
      }
    ]));

    return {
      text: "💰 *Pilih Nominal:*",
      options: {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    };
  }

  // STEP LAIN → TOLAK TEKS
  if (session.step === "WAIT_PAYMENT") {
    return {
      text: "📸 *Silakan upload FOTO bukti transfer, bukan teks.*"
    };
  }

  return null;
}

/**
 * HANDLE CALLBACK BUTTON
 */
function handleCallback(userId, data) {
  const session = sessions[userId];
  if (!session) return null;

  // === PILIH PRODUK ===
  if (session.step === "PICK_PRODUCT" && data.startsWith("PICK_")) {
    const index = parseInt(data.replace("PICK_", ""), 10);
    const product = prices[session.game][index];

    if (!product) {
      return { text: "❌ Produk tidak valid" };
    }

    session.product = product;
    session.step = "CONFIRM";

    return {
      text:
`🧾 *Konfirmasi Order*

🎮 Game: ${session.game}
🆔 ID: ${session.gameId}
🖥️ Server: ${session.server}
💎 Produk: ${product.name}
💰 Harga: Rp${product.price}

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

  // === KONFIRMASI ORDER ===
  if (data === "CONFIRM_ORDER" && session.step === "CONFIRM") {
    session.step = "WAIT_PAYMENT";
    session.status = "WAIT_PAYMENT";

    return {
      confirm: true,
      order: session
    };
  }

  // === BATAL ORDER ===
  if (data === "CANCEL_ORDER") {
    delete sessions[userId];
    return {
      text: "❌ Order dibatalkan.\n\nKetik /start untuk mulai lagi."
    };
  }

  return null;
}

/**
 * ADMIN / SYSTEM HELPERS
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

module.exports = {
  startOrder,
  handleText,
  handleCallback,
  getSession,
  setWaitingPayment,
  setStatus,
  clearSession
};