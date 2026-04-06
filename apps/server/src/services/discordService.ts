import {
  DISCASA_CATEGORY_NAME,
  DISCASA_CHANNELS,
  type GuildSummary,
} from "@discasa/shared";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  type GuildTextBasedChannel,
} from "discord.js";
import type { ActiveStorageContext, UploadedFileRecord } from "../lib/store";
import { env } from "../lib/env";

type DiscordCurrentUser = {
  id: string;
  username: string;
  avatar: string | null;
};

type DiscordUserGuild = {
  id: string;
  name: string;
  owner: boolean;
  permissions: string;
};

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

async function fetchDiscordJson<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Discord request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function hasManagePermissions(rawPermissions: string): boolean {
  const permissions = BigInt(rawPermissions || "0");
  const requiredFlags =
    PermissionsBitField.Flags.Administrator |
    PermissionsBitField.Flags.ManageGuild |
    PermissionsBitField.Flags.ManageChannels;

  return (permissions & requiredFlags) !== 0n;
}

function mapGuildPermissions(rawPermissions: string): string[] {
  const permissions = BigInt(rawPermissions || "0");
  const labels: string[] = [];

  if ((permissions & PermissionsBitField.Flags.Administrator) !== 0n) {
    labels.push("ADMINISTRATOR");
  }

  if ((permissions & PermissionsBitField.Flags.ManageGuild) !== 0n) {
    labels.push("MANAGE_GUILD");
  }

  if ((permissions & PermissionsBitField.Flags.ManageChannels) !== 0n) {
    labels.push("MANAGE_CHANNELS");
  }

  return labels;
}

function buildDiscordAvatarUrl(userId: string, avatarHash: string | null): string | null {
  if (!avatarHash) {
    return null;
  }

  const extension = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${extension}?size=128`;
}

async function fetchUserGuilds(accessToken: string): Promise<DiscordUserGuild[]> {
  return fetchDiscordJson<DiscordUserGuild[]>("/users/@me/guilds", accessToken);
}

async function fetchGuildTextChannel(channelId: string): Promise<GuildTextBasedChannel> {
  const client = await getBotClient();
  if (!client) {
    throw new Error("Discord bot is not configured.");
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased() || !("send" in channel)) {
    throw new Error("Discasa drive channel is not available.");
  }

  return channel as GuildTextBasedChannel;
}

async function findOrCreateCategory(guildId: string) {
  const client = await getBotClient();
  if (!client) {
    throw new Error("Discord bot is not configured.");
  }

  const guild = await client.guilds.fetch(guildId);
  await guild.channels.fetch();

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

  return { guild, category };
}

export async function getDiscordUser(accessToken: string): Promise<{ id: string; username: string; avatarUrl: string | null }> {
  const user = await fetchDiscordJson<DiscordCurrentUser>("/users/@me", accessToken);

  return {
    id: user.id,
    username: user.username,
    avatarUrl: buildDiscordAvatarUrl(user.id, user.avatar),
  };
}

export async function listEligibleGuilds(accessToken?: string): Promise<GuildSummary[]> {
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

  if (!accessToken) {
    return [];
  }

  const client = await getBotClient();
  if (!client) {
    return [];
  }

  const botGuilds = await client.guilds.fetch();
  const guilds = await fetchUserGuilds(accessToken);

  return guilds
    .filter((guild) => guild.owner || hasManagePermissions(guild.permissions))
    .filter((guild) => botGuilds.has(guild.id))
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      owner: guild.owner,
      permissions: mapGuildPermissions(guild.permissions),
    }))
    .sort((left, right) => {
      if (left.owner !== right.owner) {
        return left.owner ? -1 : 1;
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
}

export async function initializeDiscasaInGuild(guildId: string): Promise<ActiveStorageContext> {
  if (env.mockMode) {
    return {
      guildId,
      guildName: "Discasa Server",
      categoryId: "mock_category",
      categoryName: DISCASA_CATEGORY_NAME,
      driveChannelId: "mock_drive",
      driveChannelName: DISCASA_CHANNELS[0],
      indexChannelId: "mock_index",
      indexChannelName: DISCASA_CHANNELS[1],
      trashChannelId: "mock_trash",
      trashChannelName: DISCASA_CHANNELS[2],
    };
  }

  const { guild, category } = await findOrCreateCategory(guildId);
  await guild.channels.fetch();

  const resolvedChannels = new Map<string, { id: string; name: string }>();

  for (const channelName of DISCASA_CHANNELS) {
    const existingChannel = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildText && channel.parentId === category.id && channel.name === channelName,
    );

    const channel =
      existingChannel ??
      (await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: category.id,
        reason: "Initialize Discasa channels",
      }));

    resolvedChannels.set(channelName, {
      id: channel.id,
      name: channel.name,
    });
  }

  const driveChannel = resolvedChannels.get(DISCASA_CHANNELS[0]);
  const indexChannel = resolvedChannels.get(DISCASA_CHANNELS[1]);
  const trashChannel = resolvedChannels.get(DISCASA_CHANNELS[2]);

  if (!driveChannel || !indexChannel || !trashChannel) {
    throw new Error("Discasa channels could not be created in the selected guild.");
  }

  return {
    guildId: guild.id,
    guildName: guild.name,
    categoryId: category.id,
    categoryName: category.name,
    driveChannelId: driveChannel.id,
    driveChannelName: driveChannel.name,
    indexChannelId: indexChannel.id,
    indexChannelName: indexChannel.name,
    trashChannelId: trashChannel.id,
    trashChannelName: trashChannel.name,
  };
}

export async function uploadFilesToDiscordDrive(
  files: Express.Multer.File[],
  context: ActiveStorageContext,
): Promise<UploadedFileRecord[]> {
  if (env.mockMode) {
    return files.map((file) => ({
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype || "application/octet-stream",
      guildId: context.guildId,
      attachmentUrl: `mock://uploads/${encodeURIComponent(file.originalname)}`,
    }));
  }

  const channel = await fetchGuildTextChannel(context.driveChannelId);
  const uploaded: UploadedFileRecord[] = [];

  for (const file of files) {
    const sentMessage = await channel.send({
      files: [
        {
          attachment: Buffer.from(file.buffer),
          name: file.originalname,
        },
      ],
    });

    const attachment =
      [...sentMessage.attachments.values()].find((entry) => entry.name === file.originalname) ??
      [...sentMessage.attachments.values()][0];

    if (!attachment) {
      throw new Error(`Discord did not return an attachment URL for ${file.originalname}.`);
    }

    uploaded.push({
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype || "application/octet-stream",
      guildId: context.guildId,
      attachmentUrl: attachment.url,
    });
  }

  return uploaded;
}
