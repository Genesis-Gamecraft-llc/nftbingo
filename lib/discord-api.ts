const API = "https://discord.com/api/v10";

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const BOT_TOKEN = () => must("DISCORD_BOT_TOKEN");
const GUILD_ID = () => must("DISCORD_GUILD_ID");

async function discordFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${BOT_TOKEN()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API ${res.status} ${path}: ${text}`);
  }

  // Some endpoints return empty body
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  return res.json();
}

export async function addRole(discordUserId: string, roleId: string) {
  await discordFetch(`/guilds/${GUILD_ID()}/members/${discordUserId}/roles/${roleId}`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function removeRole(discordUserId: string, roleId: string) {
  await discordFetch(`/guilds/${GUILD_ID()}/members/${discordUserId}/roles/${roleId}`, {
    method: "DELETE",
  });
}

export async function isGuildMember(discordUserId: string) {
  // Used for sanity checks; optional
  try {
    await discordFetch(`/guilds/${GUILD_ID()}/members/${discordUserId}`, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}