// lib/invoice.js

export async function generateInvoice(data) {
  const {
    orderId,
    product,
    target,
    price,
    status,
    date
  } = data;

  // Sementara kita kirim text invoice dulu (bukan PDF)
  return `
🧾 *INVOICE PEMBAYARAN*

📌 Order ID : ${orderId}
🎮 Produk   : ${product}
🎯 Tujuan   : ${target}
💰 Harga    : Rp ${price}
📅 Tanggal  : ${date}
📦 Status   : ${status}

Terima kasih sudah menggunakan layanan kami 🙏
  `;
}
