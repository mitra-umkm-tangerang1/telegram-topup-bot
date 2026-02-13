// lib/digiflazz.js
import crypto from "crypto";
import fetch from "node-fetch";

const username = process.env.DIGIFLAZZ_USERNAME;
const apiKey = process.env.DIGIFLAZZ_API_KEY;
const baseUrl = process.env.DIGIFLAZZ_BASE_URL;

/**
 * ORDER TRANSAKSI
 */
export async function orderDigiflazz(refId, buyerSkuCode, customerNo) {
  const sign = crypto
    .createHash("md5")
    .update(username + apiKey + refId)
    .digest("hex");

  const response = await fetch(baseUrl + "/transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      buyer_sku_code: buyerSkuCode,
      customer_no: customerNo,
      ref_id: refId,
      sign
    })
  });

  return response.json();
}

/**
 * CEK STATUS TRANSAKSI
 */
export async function checkStatus(refId) {
  const sign = crypto
    .createHash("md5")
    .update(username + apiKey + refId)
    .digest("hex");

  const response = await fetch(baseUrl + "/transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      cmd: "status",
      username,
      ref_id: refId,
      sign
    })
  });

  return response.json();
}
