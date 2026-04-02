import { DISCASA_CATEGORY_NAME, DISCASA_CHANNELS, type GuildSummary } from "@discasa/shared";
import { ChannelType, Client, GatewayIntentBits, PermissionsBitField } from "discord.js";
import { env } from "../lib/env";

let botClient: Client | null = null;

async function getBotClient(): Promise<Client | null> {
  if (env.mockMode || !env.discordBotToken) {
    return null;
  }

  if (!botClient) {
    botClient = new Client({ intents: [GatewayIntentBits.Guilds] });
    await botClient.login(env.discordBotToken);
  }

  return botClient;
}

export async function listEligibleGuilds(): Promise<GuildSummary[]> {
  if (env.mockMode) {
    return [
      {
        id: "guild_1",
        name: "Discasa Server",
        owner: true,
        permissions: ["ADMINISTRATOR"],
      },
      {
        id: "guild_2",
        name: "Archive Lab",
        owner: false,
        permissions: ["MANAGE_GUILD", "MANAGE_CHANNELS"],
      },
    ];
  }

  const client = await getBotClient();
  if (!client) {
    return [];
  }

  const guilds = await client.guilds.fetch();

  return guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    owner: false,
    permissions: [],
  }));
}

export async function initializeDiscasaInGuild(guildId: string) {
  if (env.mockMode) {
    return {
      guildId,
      categoryName: DISCASA_CATEGORY_NAME,
      channels: DISCASA_CHANNELS,
    };
  }

  const client = await getBotClient();
  if (!client) {
    throw new Error("Bot client is not configured.");
  }

  const guild = await client.guilds.fetch(guildId);
  const botMember = await guild.members.fetchMe();
  const hasManageChannels = botMember.permissions.has(PermissionsBitField.Flags.ManageChannels);

  if (!hasManageChannels) {
    throw new Error("The bot is missing Manage Channels permission in the selected guild.");
  }

  const existingCategory = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === DISCASA_CATEGORY_NAME,
  );

  const category =
    existingCategory ??
    (await guild.channels.create({
      name: DISCASA_CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: "Initialize Discasa category",
    }));

  const createdChannels = [] as string[];

  for (const channelName of DISCASA_CHANNELS) {
    const existing = guild.channels.cache.find(
      (channel) => channel.parentId === category.id && channel.name === channelName,
    );

    if (!existing) {
      await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: "Initialize Discasa channels",
      });
    }

    createdChannels.push(channelName);
  }

  return {
    guildId,
    categoryName: DISCASA_CATEGORY_NAME,
    channels: createdChannels,
  };
}
