const Discord = require('discord.js');
const fs = require('fs');
const crypto = require('crypto');
const keys = require('./keys.js');
const cipherAlg = "aes-256-ctr";

var data = {}
var permissionRequests = [];

function saveStatistics() {
    var contents = JSON.stringify(data, null, 4);
    
    //Encrypt the contents
    var cipher = crypto.createCipher(cipherAlg, keys.statsKey);
    var statsJson = Buffer.concat([
        cipher.update(Buffer.from(contents, "utf8")),
        cipher.final()
    ]);

    fs.writeFileSync("stats.json", statsJson, "utf8");
}

function loadStatistics() {
    if (fs.existsSync("stats.json")) {
        var buf = fs.readFileSync("stats.json");
        var cipher = crypto.createDecipher(cipherAlg, keys.statsKey);
        var statsJson = Buffer.concat([
            cipher.update(buf),
            cipher.final()
        ]);
        statsJson = statsJson.toString("utf8");
    
        data = JSON.parse(statsJson);
    } else {
        data = {};
    }
}

function hasPermission(user) {
    if (data.hasOwnProperty(user.id)) {
        if (data[user.id].allowed) {
            return "yes";
        } else {
            return "no";
        }
    } else {
        return "indeterminate";
    }
}

function acquirePermission(user) {
    var embed = new Discord.RichEmbed();
    embed.setColor("#FFFF00");
    embed.setTitle("Statistics and Data Collection consent");
    embed.setDescription("Congratulations! You've just finished a game of FFC! We can track this for you, but we'll need to access and save the following information:");
    embed.addField("Information Required", "- Your user ID\n- Any games of FFC you've played");
    embed.addField("Enable Statistics?", "1 - Yes\n2 - No, don't ask again. We'll have to save your user ID so you won't be nagged.\n3 - No, ask me next time. We don't need to save your user ID.");
    embed.setFooter("The Discord bots Terms of Service require that we obtain your permission to store any info about you, such as your user ID. This data is encrypted with industry standard AES-256 encryption");
    user.send("", {embed: embed});
    permissionRequests.push(user.id);
    //user.channel.send("FFC can keep track of statistics for you, however, to do this, FFC needs access to save the following information:```\n- Your user ID\n- Any games of FFC you've played```\nAre you willing to enable statistics?```\n1 - Yes\n2 - No, don't ask again.")
}

function isWaitingForPermissionRequest(user) {
    if (permissionRequests.indexOf(user.id) == -1) {
        return false;
    } else {
        return true;
    }
}

function permissionRequestResponse(user, response) {
    permissionRequests.splice(permissionRequests.indexOf(user.id), 1);
    if (response == "1") {
        user.send("Thanks. We've enabled statistics for you.");
        resetStatistics(user);
    } else if (response == "2") {
        user.send("Thanks. We've disabled statistics for you.");
        data[user.id] = {
            allowed: false
        }
    } else if (response == "3") {
        user.send("Thanks. We'll ask you next time.");
    } else {
        acquirePermission(user);
    }

    saveStatistics();
}

const itemType = {
    win: 0,
    loss: 1
}

function addItem(user, item) {
    if (hasPermission(user) == "yes") {
        switch (item) {
            case itemType.win:
                data[user.id].wins = data[user.id].wins + 1;
                break;
            case itemType.loss:
                data[user.id].losses = data[user.id].losses + 1;
                break;
        }

        saveStatistics();
    }
}

function resetStatistics(user) {
    data[user.id] = {
        allowed: true,
        wins: 0,
        losses: 0
    }
}

function parseMessage(message, user) {
    if (message == "stats") {
        sendStatistics(user);
    } else if (message == "stats reset") {
        var embed = new Discord.RichEmbed();
        embed.setColor("#FFFF00");
        embed.setTitle("Statistics");

        if (data.hasOwnProperty(user.id) && data[user.id] != null && data[user.id].allowed) {
            resetStatistics();
            embed.setDescription("Your statistics have been reset.");
        } else {
            embed.setDescription("Ok, at the end of the next game I'll ask you if you want to save statistics.");
            delete data[user.id];
        }
        
        user.send("", {embed: embed});
        saveStatistics();
    }
}

function sendStatistics(user) {
    var embed = new Discord.RichEmbed();
    embed.setColor("#FFFF00");
    embed.setTitle("Statistics");
    embed.setDescription("Here are the statistics that FFC has recorded for you:");

    if (data.hasOwnProperty(user.id) && data[user.id] != null && data[user.id].allowed) {
        var stats = data[user.id];
        embed.addField("Wins", stats.wins, true);
        embed.addField("Losses", stats.losses, true);
    } else {
        embed.setColor("#FF0000");
        embed.setDescription("You have not given FFC permission to record statistics.");
    }

    user.send("", {embed: embed});
}

module.exports = {
    save: saveStatistics,
    load: loadStatistics,

    hasPermission: hasPermission,
    isWaitingForPermissionRequest: isWaitingForPermissionRequest,
    permissionRequestResponse: permissionRequestResponse,
    acquirePermission: acquirePermission,

    itemType: itemType,
    addItem: addItem,

    resetStatistics: resetStatistics,

    parseMessage: parseMessage,
    sendStatistics: sendStatistics
}

//Load statistics now
loadStatistics();