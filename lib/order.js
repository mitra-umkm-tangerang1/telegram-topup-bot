// lib/order.js
const prices = require("./price")

const sessions = {}

function startOrder(userId, game) {
  sessions[userId] = {
    step: "INPUT_ID",
    game,
    gameId: "",
    server: "",
    product: null
  }
  return "Masukkan ID Game kamu:"
}

function handleOrder(userId, text) {
  const session = sessions[userId]
  if (!session) return null

  if (session.step === "INPUT_ID") {
    session.gameId = text
    session.step = "INPUT_SERVER"
    return "Masukkan Server (contoh: 1234):"
  }

  if (session.step === "INPUT_SERVER") {
    session.server = text
    session.step = "PICK_PRODUCT"

    const list = prices[session.game]
      .map((p, i) => `${i + 1}. ${p.name} - Rp${p.price}`)
      .join("\n")

    return `Pilih nominal:\n${list}\n\nKetik angka pilihan`
  }

  if (session.step === "PICK_PRODUCT") {
    const index = parseInt(text) - 1
    const product = prices[session.game][index]
    if (!product) return "Pilihan tidak valid"

    session.product = product
    session.step = "DONE"

    return {
      done: true,
      order: session
    }
  }
}

module.exports = {
  startOrder,
  handleOrder
}