import fetch from "node-fetch";

const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

export async function sendWA(text) {
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
}