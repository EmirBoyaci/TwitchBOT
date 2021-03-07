const tmi = require("tmi.js");
const mongo = require("mongodb").MongoClient;
const cron = require("node-cron");
const { channels } = require("./channels.json");
require("dotenv").config();

const {
  findCommand,
  addCommand,
  editCommand,
  deleteCommand,
  deleteAllCommands,
  getAllCommands,
  isCoreCommand,
  checkGreeting,
  addGreetingUser,
  deleteGreetingsCollection,
  addCoreCommands,
  getCoreCommands,
  getBtc,
  getUserLevel,
  addLog,
  setSpotifyAuthorizationCode,
  getCurrentPlayingSpotifyTrack,
  refreshAllSpotifyAccessTokens,
  getCurrentPlayingSpotifyPlaylist,
} = require("./functions");

const config = {
  connection: { reconnect: true },
  identity: {
    username: process.env.BOT_USERNAME,
    password: process.env.BOT_KEY,
  },
  channels: channels,
};
const twitchClient = new tmi.client(config);
const mongoClient = new mongo(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 5000,
  keepAlive: 1,
});

twitchClient
  .connect()
  .then(() => {
    console.log(`[TWITCH-LOG] connected.`);
  })
  .catch((err) => {
    console.error(`[TWITCH-ERROR] ${err}`);
  });

mongoClient
  .connect()
  .then(() => {
    console.log(`[MONGO-LOG] connected.`);
  })
  .catch((err) => {
    console.error(`[MONGO-ERROR] ${err}`);
  });

cron.schedule(
  "30 0 * * *",
  async () => {
    console.log(`[CRON-LOG] Delete greetings cronjob executed.`);
    await deleteGreetingsCollection(mongoClient);
  },
  {
    scheduled: true,
    timezone: "Europe/Istanbul",
  }
);

cron.schedule(
  "*/50 * * * *",
  async () => {
    console.log(`[CRON-LOG] Spotify access token refresh cronjob executed.`);
    await refreshAllSpotifyAccessTokens(mongoClient);
  },
  {
    scheduled: true,
    timezone: "Europe/Istanbul",
  }
);

twitchClient.on("chat", async (channel, user, message, self) => {
  if (self) return;

  const msg = message.trim();
  const arrayMsg = msg.split(" ");
  const arrayGreetings = msg.toLowerCase().split(" ");
  const channelName = channel.slice(1);
  const displayName = user["display-name"];
  const userId = user["user-id"];
  const channelId = user["room-id"];
  const isMod =
    user.mod || user["user-type"] === "mod" || displayName === "autoMagic";
  const isBroadcaster =
    channelName === user.username || displayName === "autoMagic";
  const isModUp = isMod || isBroadcaster;

  const mongoConnection = mongoClient.db(channelName);
  const checkGreetings = await checkGreeting(
    mongoConnection,
    displayName.toLowerCase()
  );

  if (msg.charAt(0) === "!") {
    if (isModUp && arrayMsg[0] === "!komutekle") {
      if (!arrayMsg[1] || !arrayMsg[2]) {
        return twitchClient.say(channel, `@${displayName}, hatalı kullanım.`);
      } else if (await isCoreCommand(mongoConnection, arrayMsg[1])) {
        return twitchClient.say(
          channel,
          `@${displayName}, bot komutlarını tekrar ekleyemezsiniz!`
        );
      }
      const descriptionPosition = arrayMsg[0].length + arrayMsg[1].length + 2;
      const description = msg.slice(descriptionPosition);
      const commandAdded = await addCommand(
        mongoConnection,
        arrayMsg[1],
        description
      );
      await addLog(
        mongoConnection,
        displayName,
        "added",
        arrayMsg[1],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        commandAdded
          ? `@${displayName}, ${arrayMsg[1]} komutu başarıyla eklendi.`
          : `@${displayName}, ${arrayMsg[1]} komutu zaten bulunuyor veya hatalı kullanım.`
      );
    } else if (isModUp && arrayMsg[0] === "!komutdüzenle") {
      if (!arrayMsg[1] || !arrayMsg[2]) {
        return twitchClient.say(channel, `@${displayName}, hatalı kullanım.`);
      } else if (await isCoreCommand(mongoConnection, arrayMsg[1])) {
        return twitchClient.say(
          channel,
          `@${displayName}, bot komutlarını düzenleyemezsiniz!`
        );
      }
      const descriptionPosition = arrayMsg[0].length + arrayMsg[1].length + 2;
      const description = msg.slice(descriptionPosition);
      const commandEdited = await editCommand(
        mongoConnection,
        arrayMsg[1],
        description
      );
      await addLog(
        mongoConnection,
        displayName,
        "edited",
        arrayMsg[1],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        commandEdited
          ? `@${displayName}, ${arrayMsg[1]} komutu başarıyla düzenlendi.`
          : `@${displayName}, ${arrayMsg[1]} komutu bulunmuyor veya hatalı kullanım.`
      );
    } else if (isModUp && arrayMsg[0] === "!komutsil") {
      if (!arrayMsg[1]) {
        return twitchClient.say(channel, `@${displayName}, hatalı kullanım.`);
      } else if (await isCoreCommand(mongoConnection, arrayMsg[1])) {
        return twitchClient.say(
          channel,
          `@${displayName}, bot komutlarını silemezsiniz!`
        );
      }
      const commandDeleted = await deleteCommand(mongoConnection, arrayMsg[1]);
      await addLog(
        mongoConnection,
        displayName,
        "deleted",
        arrayMsg[1],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        commandDeleted
          ? `@${displayName}, ${arrayMsg[1]} komutu başarıyla silindi.`
          : `@${displayName}, ${arrayMsg[1]} komutu zaten bulunmuyor.`
      );
    } else if (isBroadcaster && arrayMsg[0] === "!tümkomutlarısil") {
      const commandDeleted = await deleteAllCommands(mongoConnection);
      await addLog(
        mongoConnection,
        displayName,
        "executed",
        arrayMsg[0],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        commandDeleted
          ? `@${displayName}, tüm komutlar başarıyla silindi.`
          : `@${displayName}, hata lütfen daha sonra tekrar deneyin.`
      );
    } else if (isModUp && arrayMsg[0] === "!botkomutları") {
      const coreCommands = await getCoreCommands(mongoConnection);
      await addLog(
        mongoConnection,
        displayName,
        "executed",
        arrayMsg[0],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        coreCommands.length > 0
          ? `@${displayName}, kullanılabilir bot komutları: ${coreCommands}`
          : `@${displayName}, hata lütfen daha sonra tekrar deneyin.`
      );
    } else if (arrayMsg[0] === "!komutlar") {
      const allCommands = await getAllCommands(mongoConnection);
      await addLog(
        mongoConnection,
        displayName,
        "executed",
        arrayMsg[0],
        getUserLevel(user)
      );
      return twitchClient.say(
        channel,
        allCommands.length > 0
          ? `@${displayName}, kullanılabilir komutlar: ${allCommands}`
          : `@${displayName}, kullanılabilir komut yok.`
      );
    }
    const command = await findCommand(mongoConnection, msg);
    if (command) {
      if (command.commandName === "!btc") {
        const btc = await getBtc();
        await addLog(
          mongoConnection,
          displayName,
          "executed",
          command.commandName,
          getUserLevel(user)
        );
        return twitchClient.say(
          channel,
          `@${displayName}, 1 BTC = ${btc.toLocaleString("tr-tr", {
            style: "currency",
            currency: "TRY",
          })}`
        );
      } else if (command.commandName === "!şarkı") {
        const currentPlayingSong = await getCurrentPlayingSpotifyTrack(
          mongoConnection
        );
        await addLog(
          mongoConnection,
          displayName,
          "executed",
          arrayMsg[0],
          getUserLevel(user)
        );
        if (currentPlayingSong === 401) {
          return twitchClient.say(
            channel,
            `@${displayName}, spotify tokenı tanımsız. Kanal sahibi fısıltı ile !spotifytoken <token> spotify tokenı belirtmelidir.`
          );
        } else if (currentPlayingSong === 204) {
          return twitchClient.say(
            channel,
            `@${displayName}, şu anda çalan şarkı yok.`
          );
        } else {
          return twitchClient.say(
            channel,
            `@${displayName}, şu anda çalan şarkı: ${currentPlayingSong}`
          );
        }
      } else if (command.commandName === "!playlist") {
        const currentPlayingPlaylist = await getCurrentPlayingSpotifyPlaylist(
          mongoConnection
        );
        await addLog(
          mongoConnection,
          displayName,
          "executed",
          arrayMsg[0],
          getUserLevel(user)
        );
        if (currentPlayingPlaylist === 401) {
          return twitchClient.say(
            channel,
            `@${displayName}, spotify tokenı tanımsız. Kanal sahibi fısıltı ile !spotifytoken <token> spotify tokenı belirtmelidir.`
          );
        } else if (currentPlayingPlaylist === 404) {
          return twitchClient.say(
            channel,
            `@${displayName}, şu anda çalan şarkı playlistten çalmıyor.`
          );
        } else if (currentPlayingPlaylist === 204) {
          return twitchClient.say(
            channel,
            `@${displayName}, şu anda çalan şarkı yok.`
          );
        } else {
          return twitchClient.say(
            channel,
            `@${displayName}, şu anda çalan playlist: ${currentPlayingPlaylist}`
          );
        }
      }
      if (command.userLevel === "mod" && isModUp) {
        await addLog(
          mongoConnection,
          displayName,
          "executed",
          command.commandName,
          getUserLevel(user)
        );
        return twitchClient.say(channel, command.description);
      } else if (command.userLevel === "everyone") {
        await addLog(
          mongoConnection,
          displayName,
          "executed",
          command.commandName,
          getUserLevel(user)
        );
        return twitchClient.say(channel, command.description);
      }
    }
  }

  if (arrayGreetings.includes("sa") && !checkGreetings) {
    twitchClient.say(channel, `Aleyküm selam hoş geldin @${displayName}`);
    await addGreetingUser(mongoConnection, displayName.toLowerCase());
  } else if (
    (arrayGreetings.includes("selam") || arrayGreetings.includes("selamlar")) &&
    !checkGreetings
  ) {
    twitchClient.say(channel, `Selam hoş geldin @${displayName}`);
    await addGreetingUser(mongoConnection, displayName.toLowerCase());
  } else if (arrayGreetings.includes("merhaba") && !checkGreetings) {
    twitchClient.say(channel, `Merhaba hoş geldin @${displayName}`);
    await addGreetingUser(mongoConnection, displayName.toLowerCase());
  }
});

twitchClient.on("whisper", async (from, user, message, self) => {
  if (self) return;

  const msg = message.trim();
  const arrayMsg = msg.toLowerCase().split(" ");
  const userName = from.slice(1);
  const displayName = user["display-name"];
  const userId = user["user-id"];

  const mongoConnection = mongoClient.db(userName);

  if (arrayMsg[0] === "!spotifytoken") {
    await setSpotifyAuthorizationCode(mongoConnection, arrayMsg[1]);
    await addLog(
      mongoConnection,
      displayName,
      "added",
      arrayMsg[0],
      "broadcaster"
    );
    return twitchClient.say(
      userName,
      `@${displayName}, spotify tokenı başarıyla eklendi.`
    );
  }
});
