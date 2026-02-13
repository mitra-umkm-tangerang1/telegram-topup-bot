import crypto from "crypto";

const username = process.env.DIGIFLAZZ_USERNAME;
const apiKey = process.env.DIGIFLAZZ_API_KEY;
const baseUrl = process.env.DIGIFLAZZ_BASE_URL;

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
