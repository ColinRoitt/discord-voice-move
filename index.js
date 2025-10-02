const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const {
  DISCORD_TOKEN,
  GUILD_ID,
  GENERAL_VC_ID,
  OTHER_TEAM_VC_ID,
  ADMIN_SHARED_SECRET = "change-me",
  PORT = 3000
} = process.env;

if (!DISCORD_TOKEN || !GUILD_ID || !GENERAL_VC_ID || !OTHER_TEAM_VC_ID) {
  console.error("Missing env vars: DISCORD_TOKEN, GUILD_ID, GENERAL_VC_ID, OTHER_TEAM_VC_ID");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember]
});

const app = express();
app.use(bodyParser.json());

// simple header auth
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    const key = req.header("x-admin-key");
    if (key !== ADMIN_SHARED_SECRET) return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

async function moveUsers(guild, userIds, targetChannelId) {
  const target = guild.channels.cache.get(targetChannelId);
  if (!target?.isVoiceBased()) throw new Error("Invalid target channel");

  const results = [];
  for (const uid of userIds) {
    try {
      // Fast path: cache; otherwise REST fetch *one* member
      const member = guild.members.cache.get(uid) || await guild.members.fetch({ user: uid });
      if (member?.voice?.channelId) {
        if (member.voice.channelId !== target.id) {
          await member.voice.setChannel(target);
        }
        results.push({ id: uid, status: "ok" });
      } else {
        results.push({ id: uid, status: "not-in-voice" });
      }
    } catch (err) {
      results.push({ id: uid, status: "error", reason: String(err) });
    }
  }
  return results;
}



// ---- API ----
function onlyTwo(id){ return id === GENERAL_VC_ID || id === OTHER_TEAM_VC_ID; }

app.get("/api/voice", async (_req, res) => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const general = guild.channels.cache.get(GENERAL_VC_ID);
    const other = guild.channels.cache.get(OTHER_TEAM_VC_ID);
    if (!general?.isVoiceBased() || !other?.isVoiceBased()) {
      return res.status(400).json({ error: "Configured channel IDs are not valid voice channels" });
    }
    const toPayload = (vc) => ({
      id: vc.id,
      name: vc.name,
      members: vc.members.map(m => ({ id: m.id, displayName: m.displayName }))
    });
    res.json({ channels: [toPayload(general), toPayload(other)] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to list voice" });
  }
});


app.post("/api/move", async (req, res) => {
  const { userIds = [], targetChannelId } = req.body || {};
  if (!Array.isArray(userIds) || !targetChannelId) {
    return res.status(400).json({ error: "userIds[] and targetChannelId are required" });
  }
  if (targetChannelId !== GENERAL_VC_ID && targetChannelId !== OTHER_TEAM_VC_ID) {
    return res.status(400).json({ error: "Target must be GENERAL_VC_ID or OTHER_TEAM_VC_ID" });
  }
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const results = await moveUsers(guild, userIds, targetChannelId);
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Move failed" });
  }
});

app.post("/api/move-selected-other", async (req, res) => {
  try {
    const { userIds = [] } = req.body || {};
    const guild = await client.guilds.fetch(GUILD_ID);
    const results = await moveUsers(guild, userIds, OTHER_TEAM_VC_ID);
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Move failed" });
  }
});



app.post("/api/all-to-general", async (_req, res) => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();
    const general = guild.channels.cache.get(GENERAL_VC_ID);
    if (!general?.isVoiceBased()) return res.status(400).json({ error: "Bad GENERAL_VC_ID" });
    const other = guild.channels.cache.get(OTHER_TEAM_VC_ID);

    const movers = [];
    if (other?.isVoiceBased()) other.members.forEach(m => movers.push(m));

    const results = [];
    for (const m of movers) {
      try {
        await m.voice.setChannel(general);
        results.push({ id: m.id, status: "ok" });
      } catch (e) {
        results.push({ id: m.id, status: "error", reason: String(e) });
      }
    }
    res.json({ results });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to move all" });
  }
});

// ---- Static (client build) ----
const clientBuild = path.join(__dirname, "client", "dist");
app.use(express.static(clientBuild));
app.use(express.static(path.join(__dirname, "public")));
app.get(/^(?!\/api\/).*/, (req, res) => {
  const file = path.join(clientBuild, "index.html");
  res.sendFile(file, err => {
    if (err) res.sendFile(path.join(__dirname, "public", "index.html"));
  });
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  app.listen(PORT, () => console.log(`Web UI on http://0.0.0.0:${PORT}`));
});
client.login(DISCORD_TOKEN);
