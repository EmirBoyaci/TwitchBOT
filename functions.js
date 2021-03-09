const coinmarketcap = require('coinmarketcap-api');
const coinMarketClient = new coinmarketcap('YOUR_COINMARKETCAP_API_KEY_HERE');
const moment = require('moment-timezone');
const axios = require('axios');
const FormData = require('form-data');
const qs = require('qs');
require('dotenv').config();

/**
 * Finds a specific command from the channel's database's commands collection. If command is found returns command, else null.
 * @param mongoConnection
 * @param commandName
 * @returns command, null
 */
const findCommand = async (mongoConnection, commandName) => {
    try {
        const collection = mongoConnection.collection('commands');
        return await collection.findOne({ commandName: commandName });
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'findCommand');
    }
};

/**
 * Get all available commands.
 * @param mongoConnection
 * @returns string
 */
const getAllCommands = async (mongoConnection) => {
    try {
        let commandArray = [];
        const collection = mongoConnection.collection('commands');
        await collection.find({}).forEach((command) => {
            commandArray.push(command.commandName);
        });
        return commandArray.length > 0
            ? commandArray
                  .sort((a, b) => {
                      return a.localeCompare(b);
                  })
                  .join(', ')
            : ``;
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getAllCommands');
    }
};

/**
 * Adds a channel command. If command is not exists and successfully added returns true, else false.
 * @param mongoConnection
 * @param commandName
 * @param description
 * @param userLevel
 * @returns true, false
 */
const addCommand = async (
    mongoConnection,
    commandName,
    description,
    userLevel = 'everyone'
) => {
    try {
        const collection = mongoConnection.collection('commands');
        const isExists = (await findCommand(mongoConnection, commandName)) !== null;
        if (!isExists && commandName.charAt(0) === '!') {
            return await collection.insertOne({
                commandName: commandName,
                description: description,
                userLevel: userLevel,
            });
        } else {
            return false;
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'addCommand');
    }
};

/**
 * Edits a channel command. If command is exists and successfully edited returns true, else false.
 * @param mongoConnection
 * @param commandName
 * @param description
 * @returns true, false
 */
const editCommand = async (mongoConnection, commandName, description) => {
    try {
        const collection = mongoConnection.collection('commands');
        const isExists = (await findCommand(mongoConnection, commandName)) !== null;
        if (isExists && commandName.charAt(0) === '!') {
            await collection.updateOne(
                { commandName: commandName },
                {
                    $set: {
                        description: description,
                    },
                }
            );
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'editCommand');
    }
};

/**
 * Deletes a channel command. If command is exists and successfully deleted returns true, else false.
 * @param mongoConnection
 * @param commandName
 * @returns true, false
 */
const deleteCommand = async (mongoConnection, commandName) => {
    try {
        const collection = mongoConnection.collection('commands');
        const isExists = (await findCommand(mongoConnection, commandName)) !== null;
        if (isExists) {
            await collection.deleteOne(
                { commandName: commandName },
                {
                    commandName: commandName,
                }
            );
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'deleteCommand');
    }
};

/**
 * Delete all channel commands. If successfully deleted returns true else false.
 * @param mongoConnection
 * @returns true, false
 */
const deleteAllCommands = async (mongoConnection) => {
    try {
        const collection = mongoConnection.collection('commands');
        return await collection.drop();
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'deleteAllCommands');
    }
};

/**
 * Finds a user from channel's database's greetings-dateNow collection. If user is found returns user, else null.
 * @param mongoConnection
 * @param username
 * @returns user, null
 */
const checkGreeting = async (mongoConnection, username) => {
    try {
        const collection = mongoConnection.collection(
            `greetings-${moment().tz('Europe/Istanbul').format('DDMMYYYY')}`
        );
        return await collection.findOne({ username: username });
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'checkGreeting');
    }
};

/**
 * Adds a user to channel's database's greetings-DDMMYYYY collection.
 * @param mongoConnection
 * @param username
 */
const addGreetingUser = async (mongoConnection, username) => {
    try {
        const collection = mongoConnection.collection(
            `greetings-${moment().tz('Europe/Istanbul').format('DDMMYYYY')}`
        );
        const isExists = (await checkGreeting(mongoConnection, username)) !== null;
        if (!isExists) {
            await collection.insertOne({
                username: username,
            });
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'addGreetingUser');
    }
};

/**
 * Finds all channels and deletes previous day's greetings collection.
 * @param mongoClient
 */
const deleteGreetingsCollection = async (mongoClient) => {
    try {
        const dbList = await mongoClient.db('automagic').admin().listDatabases();
        for (const database of dbList.databases) {
            if (database.name !== 'admin' && database.name !== 'local') {
                await mongoClient
                    .db(database.name)
                    .dropCollection(
                        `greetings-${moment()
                            .tz('Europe/Istanbul')
                            .subtract(1, 'days')
                            .format('DDMMYYYY')}`,
                        (err, isDeleted) => {
                            if (isDeleted)
                                console.log(
                                    `[MONGO-LOG] ${database.name}'s greetings-${moment()
                                        .tz('Europe/Istanbul')
                                        .subtract(1, 'days')
                                        .format('DDMMYYYY')} collection is deleted.`
                                );
                        }
                    );
            }
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'deleteGreetingsCollection');
    }
};

/**
 * Get BTC price.
 * @returns float
 */
const getBtc = async () => {
    try {
        const result = await coinMarketClient.getQuotes({
            id: [1],
            convert: 'TRY',
        });
        return result.data['1'].quote['TRY'].price;
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getBtc');
    }
};

/**
 * Adds core commands to channel's database's core-commands collection. If successfully added returns true, else false.
 * @param mongoConnection
 * @returns true, false
 */
const addCoreCommands = async (mongoConnection) => {
    try {
        const collection = mongoConnection.collection('core-commands');
        return await collection.insertMany([
            {
                commandName: '!botkomutları',
                usage: `!botkomutları`,
                userLevel: 'everyone',
            },
            {
                commandName: '!komutekle',
                usage: `!komutekle !<komut_ismi> <mesaj>`,
                userLevel: 'modUp',
            },
            {
                commandName: '!komutdüzenle',
                usage: `!komutdüzenle !<komut_ismi> <yeni_mesaj>`,
                userLevel: 'modUp',
            },
            {
                commandName: '!komutsil',
                usage: `!komutsil !<komut_ismi>`,
                userLevel: 'modUp',
            },
            {
                commandName: '!komutlar',
                usage: `!komutlar`,
                userLevel: 'everyone',
            },
            {
                commandName: '!tümkomutlarısil',
                usage: `!tümkomutlarısil`,
                userLevel: 'broadcaster',
            },
        ]);
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'addCoreCommands');
    }
};

/**
 * Checks a message is channel's core command or not. If core returns true, else false.
 * @param mongoConnection
 * @param commandName
 * @returns true, false
 */
const isCoreCommand = async (mongoConnection, commandName) => {
    try {
        if (!(await hasCoreCommands(mongoConnection))) await addCoreCommands(mongoConnection);
        const collection = mongoConnection.collection('core-commands');
        return await collection.findOne({ commandName: commandName });
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'isCoreCommand');
    }
};

/**
 * Checks channel has core commands or not. If channel has core commands return true, else false.
 * @param mongoConnection
 * @returns true, false
 */
const hasCoreCommands = async (mongoConnection) => {
    try {
        const collections = await mongoConnection.listCollections().toArray();
        for (let i = 0; i < collections.length; i++) {
            if (collections[i].name === 'core-commands') {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'hasCoreCommands');
    }
};

/**
 * Get all available core commands.
 * @param mongoConnection
 * @returns string
 */
const getCoreCommands = async (mongoConnection) => {
    try {
        let commandArray = [];
        const collection = mongoConnection.collection('core-commands');
        await collection.find({}).forEach((command) => {
            if (command.commandName !== '!botkomutları') {
                commandArray.push(command.commandName);
            }
        });
        return commandArray.length > 0
            ? commandArray
                  .sort((a, b) => {
                      return a.localeCompare(b);
                  })
                  .join(', ')
            : ``;
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getCoreCommands');
    }
};

/**
 * Returns user level.
 * @param user
 * @returns string
 */
const getUserLevel = (user) => {
    if (user.badges) {
        if (user.badges.broadcaster) {
            return 'broadcaster';
        } else if (user.badges.moderator) {
            return 'moderator';
        } else if (user.badges.vip) {
            return 'vip';
        }
    } else {
        return 'user';
    }
};

/**
 * Add log to the channel's logs collection. If log successfully added returns log, else null.
 * @param mongoConnection
 * @param userName
 * @param commandType
 * @param commandName
 * @param userLevel
 * @returns log, null
 */
const addLog = async (mongoConnection, userName, commandType, commandName, userLevel) => {
    try {
        const collection = mongoConnection.collection('logs');
        return await collection.insertOne({
            commandName: commandName,
            commandType: commandType,
            userName: userName,
            description: `${userName} has ${commandType} command ${commandName}`,
            userLevel: userLevel,
            createdAt: moment().tz('Europe/Istanbul').format('DD/MM/YYYY-HH:mm:ss'),
        });
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'addLog');
    }
};

/**
 * Set spotify authorization code into channel's settings collection and call getSpotifyAccessToken method.
 * @param mongoConnection
 * @param authorizationCode
 */
const setSpotifyAuthorizationCode = async (mongoConnection, authorizationCode) => {
    try {
        const spotifyCredentials = await getSpotifyCredentials(mongoConnection);
        const collection = mongoConnection.collection('settings');
        if (!spotifyCredentials) {
            await collection.insertOne({
                settingsName: 'spotify',
                spotifyAuthorizationCode: authorizationCode,
                spotifyAccessToken: null,
                spotifyRefreshToken: null,
            });
            await getSpotifyAccessToken(mongoConnection);
        } else {
            await collection.updateOne(
                { settingsName: 'spotify' },
                {
                    $set: {
                        spotifyAuthorizationCode: authorizationCode,
                    },
                }
            );
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'setSpofityAuthorizationCode');
    }
};

/**
 * Get channel's spotify settings.
 * @param mongoConnection
 * @returns spotifyCredentials, null
 */
const getSpotifyCredentials = async (mongoConnection) => {
    try {
        const collection = mongoConnection.collection('settings');
        return await collection.findOne({ settingsName: 'spotify' });
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getSpotifyCredentials');
    }
};

/**
 * Get spotify access token. It will work only if spotify authorization code has been set.
 * @param mongoConnection
 */
const getSpotifyAccessToken = async (mongoConnection) => {
    try {
        const collection = mongoConnection.collection('settings');
        const spotifyCredentials = await getSpotifyCredentials(mongoConnection);
        if (!spotifyCredentials.spotifyAccessToken) {
            await axios
                .post(
                    'https://accounts.spotify.com/api/token',
                    qs.stringify({
                        grant_type: 'authorization_code',
                        code: spotifyCredentials.spotifyAuthorizationCode,
                        redirect_uri: 'https://emir.codes',
                        client_id: process.env.SPOTIFY_CLIENT_ID,
                        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
                    })
                )
                .then(async (response) => {
                    await collection.findOneAndUpdate(
                        { settingsName: 'spotify' },
                        {
                            $set: {
                                spotifyAccessToken: response.data.access_token,
                                spotifyRefreshToken: response.data.refresh_token,
                            },
                        }
                    );
                })
                .catch((err) => {
                    console.error(`[POST-ERROR] ${err}`, 'getSpotifyAccessToken');
                });
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getSpotifyAccessToken');
    }
};

/**
 * Refresh spotify access token with spotify refresh token. If success returns true, else false.
 * @param mongoConnection
 * @returns true, false
 */
const refreshSpotifyAccessToken = async (mongoConnection) => {
    try {
        const collection = mongoConnection.collection('settings');
        const spotifyCredentials = await getSpotifyCredentials(mongoConnection);
        if (!spotifyCredentials.spotifyRefreshToken || !spotifyCredentials) {
            console.error(
                `[ERROR] Spotify credentials or spotify refresh token not found.`,
                'refreshSpotifyAccessToken'
            );
        } else {
            await axios
                .post(
                    'https://accounts.spotify.com/api/token',
                    qs.stringify({
                        grant_type: 'refresh_token',
                        refresh_token: spotifyCredentials.spotifyRefreshToken,
                        client_id: process.env.SPOTIFY_CLIENT_ID,
                        client_secret: process.env.SPOTIFY_CLIENT_SECRET,
                    })
                )
                .then(async (response) => {
                    await collection.findOneAndUpdate(
                        { settingsName: 'spotify' },
                        {
                            $set: {
                                spotifyAccessToken: response.data.access_token,
                            },
                        }
                    );
                })
                .catch((err) => {
                    console.error(`[POST-ERROR] ${err}`, 'refreshSpotifyAccessToken');
                    return false;
                });
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'refreshSpotifyAccessToken');
    }
    return true;
};

/**
 * Get user's current spotify track. If track is successfully found and NOT playing returns 204,
 * if spotifyAccessToken is not defined returns 401, else returns spotify track.
 * @param mongoConnection
 * @returns string, number
 */
const getCurrentPlayingSpotifyTrack = async (mongoConnection) => {
    try {
        const spotifyCredentials = await getSpotifyCredentials(mongoConnection);
        if (spotifyCredentials.spotifyAccessToken) {
            const response = await axios
                .get('https://api.spotify.com/v1/me/player/currently-playing?market=TR', {
                    headers: {
                        Authorization: `Bearer ${spotifyCredentials.spotifyAccessToken}`,
                    },
                })
                .catch(async (err) => {
                    if (err.response.data.error.status === 401) {
                        await refreshSpotifyAccessToken(mongoConnection);
                        return getCurrentPlayingSpotifyTrack(mongoConnection);
                    }
                });
            if (response.status === 200) {
                if (response.data.is_playing) {
                    let currentPlaying = '';
                    const base = response.data.item;
                    base.artists.forEach((artist) => {
                        currentPlaying += artist.name + ', ';
                    });
                    currentPlaying = currentPlaying.slice(0, currentPlaying.length - 2);
                    return (currentPlaying += ' - ' + base.name);
                } else {
                    return 204;
                }
            } else if (response.status === 204) {
                return 204;
            }
        } else {
            return await getSpotifyAccessToken(mongoConnection);
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getCurrentPlayingSpotifyTrack');
    }
};

/**
 * Finds all channels and deletes previous day's greetings collection.
 * @param mongoClient
 */
const refreshAllSpotifyAccessTokens = async (mongoClient) => {
    try {
        const dbList = await mongoClient.db('automagic').admin().listDatabases();
        for (const database of dbList.databases) {
            if (database.name !== 'admin' && database.name !== 'local') {
                const mongoConnection = mongoClient.db(database.name);
                if (await getSpotifyCredentials(mongoConnection)) {
                    const result = await refreshSpotifyAccessToken(mongoConnection);
                    if (result) {
                        console.log(
                            `[SPOTIFY-TOKEN-LOG] ${database.name}'s spotify access token refreshed.`
                        );
                    } else {
                        console.error(
                            `[SPOTIFY-TOKEN-LOG] ${database.name}'s spotify access token NOT refreshed.`
                        );
                    }
                } else {
                    console.log(
                        `[SPOTIFY-TOKEN-LOG] ${database.name}'s spotify settings not found.`
                    );
                }
            }
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'refreshAllSpotifyAccessTokens');
    }
};

/**
 * Get user's current spotify track. If track is successfully found and NOT playing returns 204,
 * if spotifyAccessToken is not defined returns 401, else returns spotify track.
 * @param mongoConnection
 * @returns string, number
 */
const getCurrentPlayingSpotifyPlaylist = async (mongoConnection) => {
    try {
        const spotifyCredentials = await getSpotifyCredentials(mongoConnection);
        if (spotifyCredentials.spotifyAccessToken) {
            const response = await axios
                .get('https://api.spotify.com/v1/me/player/currently-playing?market=TR', {
                    headers: {
                        Authorization: `Bearer ${spotifyCredentials.spotifyAccessToken}`,
                    },
                })
                .catch(async (err) => {
                    if (err.response.data.error.status === 401) {
                        await refreshSpotifyAccessToken(mongoConnection);
                        return getCurrentPlayingSpotifyPlaylist(mongoConnection);
                    }
                });
            if (response) {
                if (response.status === 200) {
                    if (response.data.context) {
                        return response.data.context.external_urls.spotify.match(
                            /playlist/g
                        ) !== null
                            ? response.data.context.external_urls.spotify
                            : 404;
                    } else {
                        return 404;
                    }
                } else {
                    return 204;
                }
            }
        } else {
            return 401;
        }
    } catch (err) {
        console.error(`[ERROR] ${err}`, 'getCurrentPlayingTracksPlaylist');
    }
};

// For future updates. Function will be developed (i.e. not working).
const getChannelPrefix = async (mongoClient, channelName) => {
    try {
        await mongoClient.connect();
        const database = mongoClient.db(channelName);
        const collection = database.collection('twitch');
        const twitchCollection = await collection.find({}).toArray();
        return twitchCollection[0].prefix;
    } catch (err) {
        console.error(`[ERROR] ${err}`);
    }
};

module.exports = {
    findCommand,
    addCommand,
    editCommand,
    deleteCommand,
    deleteAllCommands,
    getAllCommands,
    getBtc,
    isCoreCommand,
    checkGreeting,
    addGreetingUser,
    deleteGreetingsCollection,
    addCoreCommands,
    getCoreCommands,
    getUserLevel,
    addLog,
    setSpotifyAuthorizationCode,
    getCurrentPlayingSpotifyTrack,
    refreshAllSpotifyAccessTokens,
    getCurrentPlayingSpotifyPlaylist,
};
