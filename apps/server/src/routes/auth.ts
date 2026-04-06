import { Router } from "express";
import { PermissionsBitField } from "discord.js";
import { env } from "../lib/env";
import { setActiveStorageContext } from "../lib/store";
import { getDiscordUser, initializeDiscasaInGuild, listEligibleGuilds } from "../services/discordService";

const router = Router();

const botAuthorizationPermissions = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.ManageChannels,
].reduce((combined, permission) => combined | permission, 0n);

async function exchangeAuthorizationCode(code: string): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    client_id: env.discordClientId,
    client_secret: env.discordClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.discordRedirectUri,
  });

  const response = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Discord OAuth token exchange failed with status ${response.status}.`);
  }

  return (await response.json()) as { access_token: string };
}

router.get("/discord/login", (request, response) => {
  if (env.mockMode) {
    request.session.authenticated = true;
    request.session.user = {
      id: "mock_user",
      username: "Mock User",
      avatarUrl: null,
    };
    response.redirect(env.frontendUrl);
    return;
  }

  const params = new URLSearchParams({
    client_id: env.discordClientId,
    response_type: "code",
    redirect_uri: env.discordRedirectUri,
    scope: "identify guilds bot",
    permissions: botAuthorizationPermissions.toString(),
    prompt: "consent",
  });

  response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

router.get("/discord/callback", async (request, response, next) => {
  if (env.mockMode) {
    request.session.authenticated = true;
    request.session.user = {
      id: "mock_user",
      username: "Mock User",
      avatarUrl: null,
    };
    response.redirect(env.frontendUrl);
    return;
  }

  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const callbackGuildId = typeof request.query.guild_id === "string" ? request.query.guild_id : "";

    if (!code) {
      throw new Error("Discord did not return an authorization code.");
    }

    const token = await exchangeAuthorizationCode(code);
    const user = await getDiscordUser(token.access_token);

    request.session.authenticated = true;
    request.session.accessToken = token.access_token;
    request.session.user = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
    };

    let activeStorage = null;

    if (callbackGuildId) {
      try {
        activeStorage = await initializeDiscasaInGuild(callbackGuildId);
      } catch {
        activeStorage = null;
      }
    }

    if (!activeStorage) {
      const eligibleGuilds = await listEligibleGuilds(token.access_token);

      if (eligibleGuilds.length > 0) {
        activeStorage = await initializeDiscasaInGuild(eligibleGuilds[0].id);
      }
    }

    setActiveStorageContext(activeStorage);
    response.redirect(env.frontendUrl);
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
