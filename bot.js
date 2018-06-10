const Discord = require('discord.js');
const client = new Discord.Client({
    restTimeOffset: 10
});
//const Game = require('./game.js');
const keys = require('./keys.js');

var nextId = 0;
var invitingChannels = {};
var runningGames = {};
var userCurrentPrefixes = {};
var prefix = "ffc:";

global.Statistics = require('./statistics.js');

const help = [
    "At the beginning of the game, each player starts with 7 cards. The aim of the game is to clear all your cards before every other player.\n\nTo view your hand, use the `hand` command.\nTo play a card, use the `play` command.\nMore commands can be found in the **Commands** section below.",
    "When it is your turn to play a card, you may only play\n- cards of the same colour,\n- cards of the same number or symbol\n- wildcards\n\nIf you cannot play any of these cards from your hand, you must draw from the deck by using the `draw` command.\n\nCards are given in the following format:\nFIRST CHARACTER: Either `R` `G` `B` `Y` or `+`. `+` indicates wildcard, other letters indicate colour.\nSECOND CHARACTER: Either a number, `B`, `S` or `+`. When first character is a colour, number indicates face value, `B` is skip, `S` is rotate and `+` is draw two. When first character is a wildcard, `W` indicates normal wildcard, `4` indicates Wild Draw Four.",
    "Whenever you switch games, you must prefix the command with the Game ID that you wish to action on. Every command thereafter will be actioned on the same game, until FFC meets a new game ID.\n\n`hand` View your hand\n`play c` Play the card specified by `c` from your hand\n`draw` Draw a card from the deck\n`status` Show the status of other players and the game\n`chat [message]` Sends a message to the whole room\n`!` Challenges another player (if there is something that can be challenged)\n`nudge` Reminds the current player that it is their turn\n`ffc` Call out FFC to indicate it is your final card\n`drop` Leave the room\n\n*Examples:*\n`1 play B9` plays B9 from your hand in Game #1\n`3 draw` draws a card from the deck in Game #3\n`2 chat Hello!` sends `Hello!` to every player in Game #2\n\n**If a command is not recognised, it will be interpreted as a `chat` command.**",
    "There are many types of cards in Uno, and a description of each is as follows.\n- When the first character is a `+` and the second character is a\n  - `W`: Wildcard. This can be played at any time. The player has the ability to change the current colour by indicating the colour to be played. *Example:* `2 play +WR` plays a Wild card and changes the colour to red.\n  - `4`: Wild Draw Four. See below for details.\n- Otherwise, when the second character is\n  - `B`: Skip. Skips the next player's turn\n  - `S`: Reverse. Reverses the direction of play.\n  - `+` Draw Two. Next player draws two cards and their turn is skipped.\n  - A number: Number card. Play continues as normal.",
    "The Wild Draw Four card may only be played if you have no other cards that can be played (excluding wildcards.) The player to receive the four cards has the option to challenge the Wild Draw Four. If the Wild Draw Four is challenged, and it was played illegally, the player who played the Wild Draw Four must draw four cards. Otherwise, the player who challenged must draw six cards.",
    "On your second to last card, you must call FFC by using the `ffc` command. This alerts all players that you have one card left. Failure to do so will still alert all other players, and additionally, you are able to be challenged until the next player plays a card (or draws from the draw pile.) If you are challenged, you must draw two cards.",
    "In a Two Player game, the Reverse card acts like a skip card."
]

process.on('unhandledRejection', function(err, p) {
    console.log(err.stack);
});

process.on('uncaughtException', function(err) {
    //Uncaught Exception

    console.log(err.stack, logType.critical);
});

client.on("message", function(message) {
    if (!message.author.bot) {
        try {
            if (message.guild == null) {
                if (Statistics.isWaitingForPermissionRequest(message.author)) {
                    Statistics.permissionRequestResponse(message.author, message.content);
                } else {
                    if (message.content.toLowerCase() == "help") {
                        var embed = new Discord.RichEmbed();
                        embed.setTitle("Final Fantastic Card Help");
                        embed.setDescription("Welcome to Final Fantastic Card!");
                        embed.addField("Gameplay", help[0]);
                        embed.addField("Cards", help[1]);
                        embed.addField("Commands", help[2]);
                        embed.addField("Card Effects", help[3])
                        embed.addField("Wild Draw Four", help[4])
                        embed.addField("Calling FFC", help[5])
                        embed.addField("Two Player Game", help[6]);
                        embed.setColor("#FFFF00");
                        message.author.send("", {embed: embed});
                    } else if (message.content.toLowerCase() == "uptime") {
                        var uptime = parseInt(client.uptime); // Get uptime in ms
                        uptime = Math.floor(uptime / 1000); // Convert from ms to s
                        var uptimeMinutes = Math.floor(uptime / 60); // Get the uptime in minutes
                        var minutes = uptime % 60;
                        var hours = 0;

                        while (uptimeMinutes >= 60) {
                            hours++;
                            uptimeMinutes = uptimeMinutes - 60;
                        }

                        if (uptimeMinutes < 10) {
                            timeString = hours + ":0" + uptimeMinutes // We need to add an additional 0 to the minutes
                        } else {
                            timeString = hours + ":" + uptimeMinutes // We don't need to add an extra 0.
                        }

                        message.reply(":clock1: Final Fantastic Card has been up for " + timeString + " hours. Note that this may not neccessarily be the amount of time since the last game module update.");
                    } else if (message.content.toLowerCase() == "help commands" || message.content.toLowerCase() == "help cmd") {
                        var embed = new Discord.RichEmbed();
                        embed.setTitle("Final Fantastic Card Help");
                        embed.setDescription("Welcome to Final Fantastic Card!");
                        embed.addField("Commands", help[2]);
                        embed.setColor("#FFFF00");
                        message.author.send("", {embed: embed});
                    } else if (message.content.toLowerCase().startsWith("stats")) {
                        Statistics.parseMessage(message.content.toLowerCase(), message.author);
                    } else {
                        var gameId = message.content.split(" ")[0];
                        var game = runningGames[gameId];
                        if (game == null) {
                            if (userCurrentPrefixes[message.author.id] == null) {
                                message.channel.send("Please prefix your command with a game ID.");
                            } else {
                                game = runningGames[userCurrentPrefixes[message.author.id]];
                                if (game == null) {
                                    message.channel.send("Please prefix your command with a game ID.");
                                } else {
                                    game.ParseDM(message.author, message.content.substr(message.content), message);
                                }
                            }
                        } else {
                            userCurrentPrefixes[message.author.id] = gameId;
                            game.ParseDM(message.author, message.content.substr(message.content.indexOf(" ") + 1), message);
                        }
                    }
                }
            } else {
                if (!message.content.startsWith(prefix)) {
                    return;
                }

                if (message.guild.id == "451301259702566922" && message.channel.id != "452909687848042516") {
                    return;
                }

                let closeGameFunction = function(wasAutomatic = false) {
                    if (invitingChannels[message.channel.id] == null) {
                        message.channel.send("There is no game room at the moment. To start a new game, `" + prefix + "join`");                    
                    } else {
                        clearTimeout(invitingChannels[message.channel.id].gameCloseTimer);
                        if (invitingChannels[message.channel.id].Close()) {
                            var game = invitingChannels[message.channel.id];
                            message.channel.send("Game #" + parseInt(game.id) + " has been closed and is now starting.");
                            runningGames[game.id] = game;
                        } else {
                            if (wasAutomatic) {
                                message.channel.send("**Game closed**\nThe game has been automatically closed due to 5 minutes of inactivity.");
                            } else {
                                message.channel.send("**Game closed**\nThe game has been closed, but there were no players.");
                            }
                            invitingChannels[message.channel.id].Finalise()
                        }
                        invitingChannels[message.channel.id] = null;
                    }
                }

                let command = message.content.substr(prefix.length);
                if (command == "close") {
                    closeGameFunction();
                } else if (command == "spectate") {
                    if (invitingChannels[message.channel.id] == null) {
                        message.channel.send("There is no game room at the moment. To start a new game, `" + prefix + "join`. You can spectate a currently running game by sending me `[game ID] spectate`.");                    
                    } else {
                        invitingChannels[message.channel.id].SpectateUser(message.author);
                        userCurrentPrefixes[message.author.id] = invitingChannels[message.channel.id].id;
                    }
                } else if (command == "help") {
                    var embed = new Discord.RichEmbed();
                    embed.setTitle("Final Fantastic Card");
                    embed.setDescription("Welcome to Final Fantastic Card!");
                    embed.setColor("#FFFF00");
                    embed.addField("What am I?", "Final Fantastic Card is Uno™, in bot form. Games are played through DMs as to not pollute the chat.")
                    embed.addField("Great, so how do I start?", "To create a room to play in, just type `" + prefix + "join` here and I'll walk you through it.")
                    embed.addField("I don't know how FFC works.", "For information on how to play, go ahead and DM me `help`. For information on commands you can DM me, just DM me `help commands`. Be warned though; the `help` command gives you a 3 page dissertation on how to play Final Fantastic Card. If you already know, the `help commands` command is what you need.");
                    embed.setFooter("More help is available if you DM me `help`.");
                    message.channel.send("", {embed: embed});
                } else if (command.startsWith("join")) {
                    if (invitingChannels[message.channel.id] == null) {
                        nextId++;
                        let GameObject;
                        let GameArgs = command.substr(5);
                        let GameName;

                        if (command.indexOf("--blueprint") != -1) {
                            GameObject = require("./gameb.js");
                            GameArgs.replace("--blueprint", "");
                            GameName = "Final Fantastic Card Blueprint";
                        } else {
                            GameObject = require("./game.js");
                            GameName = "Final Fantastic Card";
                        }

                        invitingChannels[message.channel.id] = new GameObject(nextId, GameArgs);
                        invitingChannels[message.channel.id].AddUser(message.author);
                        invitingChannels[message.channel.id].gameCloseTimer = setTimeout(closeGameFunction, 300000, true);
                        message.channel.send("**__Ready to play " + GameName + "?__**\n" +
                                             "*" + message.author.tag + "* has started *Game #" + nextId + "*.\n" +
                                             "- To join this game, use `" + prefix + "join`\n" +
                                             "- To spectate this game, use `" + prefix + "spectate`\n" +
                                             "- Once everyone has joined the room, use `" + prefix + "close` to close the room and start playing.\n" +
                                             "The room will automatically be closed in 5 minutes.");
                        userCurrentPrefixes[message.author.id] = nextId;
                        delete require.cache[require.resolve("./game.js")]
                    } else {
                        if (invitingChannels[message.channel.id].IsRoomFull()) {
                            message.channel.send("This room is full.");
                        } else {
                            var addReply = invitingChannels[message.channel.id].AddUser(message.author);
                            if (addReply == "ok") {
                                message.channel.send("**" + message.author.tag + "** has joined the room.");
                                userCurrentPrefixes[message.author.id] = invitingChannels[message.channel.id].id;
                            } else if (addReply == "duplicate") {
                                message.reply("You're already in that room.");
                            }
                        }
                    }
                }
            }
        } catch (err) {
            var embed = new Discord.RichEmbed;
            embed.setColor("#FF0000");
            embed.addField("Details", err.message);
    
            console.log(err.stack);

            embed.setTitle("<:exception:346458871893590017> Internal Error");
            embed.setFooter("This error has been logged, and we'll look into it.");
            embed.setDescription("Final Fantastic Card has run into a problem trying to process that command.");
            
            message.channel.send("", {embed: embed});
        }
    }
});

client.on("ready", function() {
    console.log("FFC is now ready");

    client.user.setPresence({
        game: {
            type: 0,
            name: "Uno™"
        },
        status: "online",
        afk: false
    });
});

client.login(keys.key).catch(function() {
    console.log("Login error");
});
