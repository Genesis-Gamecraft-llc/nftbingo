import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fetch from "node-fetch";

const APP_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

if (!APP_ID || !BOT_TOKEN) {
  console.error("Missing env vars");
  process.exit(1);
}

const commands = [
  {
    name: "verify",
    description: "Verify your wallet to receive holder roles.",
  },
  {
    name: "refresh",
    description: "Re-check your wallet and refresh roles.",
  }
];

const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

async function main() {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  const data = await res.text();
  console.log(res.status, data);
}

main();