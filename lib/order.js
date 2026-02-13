// lib/order.js
import crypto from "crypto";
import fetch from "node-fetch";
import { sendWA } from "./wa.js";

const sessions = {};
let cachedProducts = null;
let lastFetch = 0;

const username = process.env.DIGIFLAZZ_USERNAME;
const apiKey = process.env.DIGIFLAZZ_API_KEY;
const baseUrl = process.env.DIGIFLAZZ_BASE_URL;

// ================= FORMAT =================
const formatRupiah = (num) =>
  "Rp" + new Intl.NumberFormat("id-ID").format(Number(num));

// ================= AMBIL PRODUK DIGIFLAZZ =================
async function getProducts() {
  const now = Date.now();

  if (cachedProducts && now - lastFetch < 5 * 60 * 1000) {
    return cachedProducts;
  }

  const sign = crypto
    .createHash("md5")
    .update(username + apiKey + "pricelist")
    .digest("hex");

  const response = await fetch(baseUrl + "/price-list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "prepaid",
      username,
      sign
    })
  });

  const result = await response.json();
  if (!result?.data) return [];

  const products = result.data
    .filter(p => p.buyer_sku_code && p.price)
    .map(p => ({
      ...p,
      sell_price: Number(p.price) + 3000
    }));

  cachedProducts = products;
  lastFetch = now;

  return products;
}

// ================= AMBIL KATEGORI =================
function getCategories(products) {
  const categories = [...new Set(products.map(p => p.category))];
  return categories.filter(Boolean);
}

// ================= START ORDER =================
async function startOrder(userId) {
  const products = await getProducts();
  const categories = getCategories(products);

  if (!categories.length) {
    return { text: "❌ Produk tidak tersedia." };
  }

  sessions[userId] = {
    step: "PICK_CATEGORY",
    status: "INPUT",
    category: "",
    product: null,
    customerNo: ""
  };

  const buttons = categories.slice(0, 20).map(cat => ([
    { text: cat, callback_data: `CAT_${cat}` }
  ]));

  return {
    text: "📦 Pilih Kategori Produk:",
    options: {
      reply_markup: {
        inline_keyboard: buttons
      }
    }
  };
}

// ================= HANDLE TEXT =================
async function handleText(userId, text) {
  const session = sessions[userId];
  if (!session) return null;

  if (session.step === "INPUT_TARGET") {
    session.customerNo = text;
    session.step = "CONFIRM";

    return {
      text:
`🧾 Konfirmasi Order

📦 Produk: ${session.product.product_name}
🎯 Tujuan: ${session.customerNo}
💰 Harga: ${formatRupiah(session.product.sell_price)}

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

  if (session.step === "WAIT_PAYMENT") {
    return { text: "📸 Silakan upload FOTO bukti transfer." };
  }

  return null;
}

// ================= HANDLE CALLBACK =================
async function handleCallback(userId, data) {
  const session = sessions[userId];
  if (!session) return null;

  // ===== PILIH KATEGORI =====
  if (session.step === "PICK_CATEGORY" && data.startsWith("CAT_")) {
    const category = data.replace("CAT_", "");
    session.category = category;
    session.step = "PICK_PRODUCT";

    const allProducts = await getProducts();
    const filtered = allProducts.filter(p => p.category === category);

    if (!filtered.length) {
      return { text: "❌ Produk tidak tersedia." };
    }

    session.availableProducts = filtered.slice(0, 30);

    const buttons = session.availableProducts.map((item, i) => ([
      {
        text: `${item.product_name} — ${formatRupiah(item.sell_price)}`,
        callback_data: `PICK_${i}`
      }
    ]));

    return {
      text: `📦 Produk kategori ${category}:`,
      options: {
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    };
  }

  // ===== PILIH PRODUK =====
  if (session.step === "PICK_PRODUCT" && data.startsWith("PICK_")) {
    const index = Number(data.replace("PICK_", ""));
    const product = session.availableProducts[index];

    if (!product) return { text: "❌ Produk tidak valid." };

    session.product = product;
    session.step = "INPUT_TARGET";

    return {
      text: "📱 Masukkan nomor tujuan / ID pelanggan:"
    };
  }

  // ===== KONFIRMASI =====
  if (data === "CONFIRM_ORDER" && session.step === "CONFIRM") {
    session.step = "WAIT_PAYMENT";
    session.status = "WAIT_PAYMENT";

    await sendWA(`ORDER MASUK

Kategori: ${session.category}
Produk: ${session.product.product_name}
Tujuan: ${session.customerNo}
Harga: ${formatRupiah(session.product.sell_price)}`);

    return {
      confirm: true,
      order: session
    };
  }

  if (data === "CANCEL_ORDER") {
    delete sessions[userId];
    return {
      text: "❌ Order dibatalkan.\nKetik /start untuk mulai lagi."
    };
  }

  return null;
}

// ================= HELPERS =================
function getSession(userId) {
  return sessions[userId] || null;
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
  setStatus,
  clearSession
};
