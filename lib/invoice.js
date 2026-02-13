// lib/invoice.js
import PDFDocument from "pdfkit";

export function generateInvoicePDF(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const {
        invoice,
        product,
        price,
        target,
        sn
      } = data;

      doc.fontSize(20).text("INVOICE TRANSAKSI", { align: "center" });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Invoice ID : ${invoice}`);
      doc.text(`Produk     : ${product}`);
      doc.text(`Target     : ${target}`);
      doc.text(`Harga      : ${price}`);
      doc.text(`Status     : SUKSES`);
      doc.moveDown();

      doc.text("SN / Kode:", { underline: true });
      doc.moveDown(0.5);
      doc.text(sn || "-", {
        width: 400
      });

      doc.moveDown();
      doc.text("Terima kasih sudah menggunakan layanan kami 🙏", {
        align: "center"
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
