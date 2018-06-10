const Discord = require('discord.js');
const GameModuleVersion = "1.0.1.4";

var exp = function(id, houseRules) {
    this.users = [];
    this.spectators = [];
    this.userDecks = {};

    this.currentTurn = -1;
    this.direction = 0;
    this.topCard = "";
    this.currentColor = "";

    this.justDrew = "";

    this.didCallFFC = false;
    this.challengeUser = null;
    this.challengeCards = 0;

    this.resolvingPlusFour = false;
    this.plusFourChallengeSuccess = false;
    this.plusFourPlayer = null;
    
    this.finished = false;

    this.houseRules = {
        cumulativeDraw: false
    };
    if (houseRules.indexOf("C") != -1) {
        this.houseRules.cumulativeDraw = true;
    }

    this.drawingCards = 0;

    this.id = id;
}

exp.prototype.AddUser = function(user) {
    if (this.users.length < 10) {
        for (userIndex in this.users) {
            if (this.users[userIndex].id == user.id) {
                return "duplicate";
            }
        }
        for (userIndex in this.spectators) {
            if (this.spectators[userIndex].id == user.id) {
                return "duplicate";
            }
        }
        this.users.push(user);

        var embed = this.CreateEmbed(user, "You have been added to Game #" + parseInt(this.id));
        embed.setColor("#FFFF00");
        embed.setFooter("This game is using Final Fantastic Card Module Version " + GameModuleVersion);

        var houseRules = "";
        if (this.houseRules.cumulativeDraw) {
            houseRules += "- Cumulative Draw";
        }
        if (houseRules != "") {
            embed.addField("Effective House Rules", houseRules);
        }

        user.send("", {embed: embed});

        return "ok";
    } else {
        return "full";
    }
}

exp.prototype.SpectateUser = function(user) {
    for (userIndex in this.users) {
        if (this.users[userIndex].id == user.id) {
            InformUser(this, user, "You are already playing Game #" + parseInt(this.id));
            return;
        }
    }
    for (userIndex in this.spectators) {
        if (this.spectators[userIndex].id == user.id) {
            InformUser(this, user, "You are already spectating Game #" + parseInt(this.id));
            return;
        }
    }
    this.spectators.push(user);

    var embed = this.CreateEmbed(user, "You are now spectating Game #" + parseInt(this.id));
    embed.setColor("#FFFF00");
    embed.setFooter("This game is using Final Fantastic Card Module Version " + GameModuleVersion);
    
    var houseRules = "";
    if (this.houseRules.cumulativeDraw) {
        houseRules += "- Cumulative Draw";
    }
    if (houseRules != "") {
        embed.addField("Effective House Rules", houseRules);
    }
    
    user.send("", {embed: embed});
}

exp.prototype.IsRoomFull = function() {
    return this.users.length == 10
}

function InformUser(game, user, message, colour = "#FFFF00", thumb = "") {
    var embed = new Discord.RichEmbed();

    embed.setTitle("Game #" + parseInt(game.id));
    embed.setDescription(message);
    embed.setColor(colour);

    if (thumb != "") {
        embed.attachFile("./images/" + thumb);
        embed.setThumbnail("attachment://" + thumb);
    }

    user.send("", {embed: embed});
}

exp.prototype.CreateEmbed = function(user, message) {
    var embed = new Discord.RichEmbed();
    embed.setTitle("Game #" + parseInt(this.id));
    embed.setDescription(message);

    return embed;
}

exp.prototype.Close = function() {
    if (this.users.length == 1) {
        return false;
    } else {
        this.IterateUsers(function(me, user) {
            InformUser(me, user, "This game is now starting.");
            var deck = [];
            for (var i = 0; i < 7; i++) {
                deck.push(GetRandomCard());
            }
            me.userDecks[user.id] = deck;
        }, false);
        this.topCard = GetRandomCard();
        while (this.topCard[0] == "+" || this.topCard[1] == "R" || this.topCard[1] == "S" || this.topCard[1] == "+") {
            this.topCard = GetRandomCard();
        }
        this.currentColor = this.topCard[0];
        this.NextTurn();
        return true;
    }
}

exp.prototype.IterateUsers = function(fn, includeSpectators = true) {
    for (userIndex in this.users) {
        var user = this.users[userIndex];
        fn(this, user);
    }

    if (includeSpectators) {
        for (userIndex in this.spectators) {
            var user = this.spectators[userIndex];
            fn(this, user);
        }
    }
}

exp.prototype.Finalise = function() {
    this.finished = true;

    this.IterateUsers(function(me, user) {
        var hand = me.GetHandString(me.userDecks[user.id]);
        if (hand == "") { //Winner
            Statistics.addItem(Statistics.itemType.win);
        } else {
            Statistics.addItem(Statistics.itemType.loss);
        }
    }, false);

    this.IterateUsers(function(me, user) {
        var embed = me.CreateEmbed(user, "Game #" + parseInt(me.id) + " is now closed.");
        embed.setColor("#FF0000");

        me.IterateUsers(function(me, user) {
            var hand = me.GetHandString(me.userDecks[user.id]);
            if (hand == "") {
                embed.addField(user.username, "No cards");
            } else {
                embed.addField(user.username, hand);
            }
        }, false);

        user.send("", {embed: embed});

        if (Statistics.hasPermission(user) == "indeterminate") {
            Statistics.acquirePermission(user);
        }
    });
}

exp.prototype.GetHandString = function(deck) {
    var deckString = "";
    for (deckIndex in deck) {
        var card = deck[deckIndex];
        if (this.CanPlayCard(card) != "no") {
            deckString += "**" + card + "** ";
        } else {
            deckString += card + " ";
        }
    }
    return deckString;
}

exp.prototype.ParseDM = function(user, message, messageObj) {
    var lmessage = message.toLowerCase();
    if (this.users.indexOf(user) == -1 && this.spectators.indexOf(user) == -1) {
        if (lmessage == "spectate") {
            this.SpectateUser(user);
        } else {
            user.send("You're not in this game.");
        }
    } else {
        var spectator;
        if (this.users.indexOf(user) == -1) {
            spectator = true;
        }

        if (lmessage == "hand" && !spectator) {
            var deck = this.userDecks[user.id];
            var embed = this.CreateEmbed(user, "Current Hand");
            
            embed.addField("Hand", this.GetHandString(deck));
            user.send("", {embed: embed});
        } else if (lmessage.startsWith("play ") && !spectator) {
            if (this.finished) {
                user.send("This game has ended. No more cards can be played.");
            } else if (user == this.users[this.currentTurn]) {
                if (this.resolvingPlusFour) {
                    user.send("Before you can play this card, you'll need to challenge the Wild Draw Four, or draw the four cards before you can continue.");
                } else {
                    var card = message.substr(5).toUpperCase();
                    var deck = this.userDecks[user.id];

                    if (deck.indexOf(card.substr(0, 2)) == -1) {
                        user.send("You don't seem to have that card.");
                    } else {
                        //Check validity
                        var playable = this.CanPlayCard(card);

                        if (this.justDrew == "") {
                            if (playable == "no") {
                                user.send("You can't play that card.");
                            } else if (playable == "yes") {
                                this.PlayCard(card, user);
                            } else if (playable == "wild") {
                                let example;
                                if (card[2] == "4") {
                                    example = "play +4B"
                                } else {
                                    example = "play +WB"
                                }
                                user.send("Indicate the colour you wish to play this wildcard with by appending it to the end of the command. For example, `" + example + "` to change the colour to blue.");                   
                            }
                        } else {
                            if (this.justDrew == card.substr(0, 2)) {
                                if (playable != "wild") {
                                    this.PlayCard(card, user);
                                }
                            }
                        }
                    }
                }
            } else {
                user.send("It is not your turn.");
            }
        } else if (lmessage == "draw" && !spectator) {
            if (this.finished) {
                user.send("This game has ended. No more cards can be picked up.");
            } else if (this.drawingCards > 0) {
                user.send("You can only play a Draw Two card.");
            } else if (user == this.users[this.currentTurn]) {
                if (this.resolvingPlusFour) {
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    
                    var user = this.users[this.currentTurn];
                    InformUser(this, user, "You have drawn four cards. Your turn has been skipped.", "#FF0000", "draw4Card.png");
                    this.IterateUsers(function(me, iuser) {
                        if (iuser.id != user.id) {
                            InformUser(me, iuser, user.username + " has drawn four cards.", "#FF0000", "draw4Card.png");
                        }
                    });
                    this.resolvingPlusFour = false;
                    this.NextTurn();
                } else if (this.justDrew == "") {
                    if (this.HasPlayableCards(user, true)) {
                        user.send("You have playable cards, so you cannot draw a card now.");
                    } else {
                        var embed = this.CreateEmbed(user, "Card Drawn");
                        embed.setDescription("You picked up a card");
                        embed.setColor("#FF0000");

                        var card = GetRandomCard();
                        embed.addField("Card", card);
                        
                        if (this.CanPlayCard(card) == "no") {
                            this.NextTurn();
                        } else {
                            this.justDrew = card;
                            embed.addField("Alert", card + " is currently playable. You can play this card by typing `play " + card + "` now, or use the `draw` command to pass play onto the next player.");
                        }

                        embed.attachFile("./images/drawCard.png");
                        embed.setThumbnail("attachment://drawCard.png");
                        user.send("", {embed: embed});

                        this.userDecks[user.id].push(card);

                        this.IterateUsers(function(me, iuser) {
                            if (iuser.id != user.id) {
                                InformUser(me, iuser, user.username + " has taken a card from the draw pile.", "#FF0000", "drawCard.png");
                            }
                        });
                    }
                } else {
                    user.send("You passed on playing the card.");
                    this.NextTurn();
                }
            } else {
                user.send("It is not your turn.");
            }
        } else if (lmessage == "status") {
            var embed = this.CreateEmbed(user, "Game Status");
            var cardStats = "";
            this.IterateUsers(function(me, user) {
                if (user == me.users[me.currentTurn]) {
                    cardStats += "**" + user.username + "**";
                } else {
                    cardStats += user.username
                }
                cardStats += " - " + parseInt(me.userDecks[user.id].length) + " cards\n";
            }, false);
            
            if (this.finished) {
                cardStats += "**The game has ended.**";
            } else if (this.direction == 0) {
                cardStats += "**Play continues downwards**";
            } else {
                cardStats += "**Play continues upwards**";
            }

            embed.addField("Cards", cardStats);

            user.send("", {embed: embed});
        } else if (lmessage == "ffc" && !spectator) {
            if (user == this.users[this.currentTurn]) {
                var deck = this.userDecks[user.id];
                if (deck.length == 2) {
                    this.didCallFFC = true;
                    this.IterateUsers(function(me, iuser) {
                        InformUser(me, iuser, user.username + " has called FFC!");
                    });
                } else {
                    user.send("You have more than one card.");
                }
            } else {
                user.send("It is not your turn.");
            }
        } else if (lmessage == "!" && !spectator) {
            if (this.resolvingPlusFour) {
                if (this.plusFourChallengeSuccess) {
                    this.IterateUsers(function(me, iuser) {
                        InformUser(me, iuser, user.username + " has challenged the Wild Draw Four played by " + me.plusFourPlayer.username + ", and has won the challenge. " + me.plusFourPlayer.username + " has drawn four cards.");
                    });

                    this.userDecks[this.plusFourPlayer.id].push(GetRandomCard());
                    this.userDecks[this.plusFourPlayer.id].push(GetRandomCard());
                    this.userDecks[this.plusFourPlayer.id].push(GetRandomCard());
                    this.userDecks[this.plusFourPlayer.id].push(GetRandomCard());
                    
                    var user = this.users[this.currentTurn];
                    InformUser(this, this.plusFourPlayer, "You have drawn four cards.", "#FF0000", "draw4Card.png");
                } else {
                    var embed = this.CreateEmbed(user, user.username + " has challenged the Wild Draw Four played by " + this.plusFourPlayer.username + ", and has lost the challenge. " + user.username + " has drawn six cards.");
                    embed.setColor("#FF0000");
                    this.IterateUsers(function(me, iuser) {
                        iuser.send("", {embed: embed});
                    });

                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
                    
                    var user = this.users[this.currentTurn];
                    InformUser(this, user, "You have drawn six cards. Your turn has been skipped.", "#FF0000", "draw6Card.png");
                    this.NextTurn();
                }
                this.resolvingPlusFour = false;
            }
        } else if (lmessage == "nudge" && !spectator) {
            this.users[this.currentTurn].send(user.username + " wished to remind you that it is your turn to play by giving you a gentle nudge. Nudge!");
            user.send("I've nudged the current player.");
        } else if (lmessage.startsWith("chat ")) {
            var msg = message.substr(5);
            this.IterateUsers(function(me, iuser) {
                if (user.id != iuser.id) {
                    iuser.send("**#" + me.id + " " + user.username + ":** " + msg);
                }
            });
            messageObj.react("✅");
        } else if (lmessage == "topcard") {
            InformUser(this, user, "The current card is `" + this.topCard + "`");
        } else if (lmessage == "drop") {
            if (spectator) {
                var currentUserIndex = this.spectators.indexOf(user);
                this.spectators.splice(currentUserIndex, 1);

                InformUser(this, user, "You have dropped from Game #" + this.id);
            } else {
                var currentUserIndex = this.users.indexOf(user);
                this.users.splice(currentUserIndex, 1);

                //Checking for invalid states
                if (this.users.length == 1) {
                    InformUser(this, this.users[0], user.username + " has dropped from the game, and you are the only player remaining. The game has ended.");
                    this.Finalise();
                    return;
                }

                InformUser(this, user, "You have dropped from Game #" + this.id);
                this.IterateUsers(function(me, iuser) {
                    InformUser(me, iuser, user.username + " has dropped from the game.");
                });

                if (this.currentTurn >= this.users.length) {
                    this.NextTurn();
                } else {
                    var embed = this.CreateEmbed(user, "It is now your turn.");
                    embed.setColor("#00FF00");
                    embed.addField("Current Card", this.topCard);

                    var deck = this.userDecks[user.id];
                    embed.addField("Hand", this.GetHandString(deck));

                    user.send("", {embed: embed});
                }
            }
        } else {
            if (process.argv.indexOf("--debug") != -1) {
                if (message.startsWith("give ") && !spectator) {
                    var card = message.substr(5).toUpperCase();
                    this.userDecks[this.users[this.currentTurn].id].push(card);
                    user.send("Done.");
                    return;
                }
            }

            //Assume that the user wants to chat to the party
            var msg = message;
            this.IterateUsers(function(me, iuser) {
                if (user.id != iuser.id) {
                    iuser.send("**#" + me.id + " " + user.username + ":** " + msg);
                }
            });
            messageObj.react("✅");
        }
    }
}

exp.prototype.PlayCard = function(card, user) {
    card = card.toUpperCase();
    this.userDecks[user.id].splice(this.userDecks[user.id].indexOf(card.substr(0, 2)), 1);

    this.IterateUsers(function(me, iuser) {
        InformUser(me, iuser, user.username + " played a `" + card + "`");
    });

    if (card[0] == "+") {
        if (card[2] != "B" && card[2] != "G" && card[2] != "R" && card[2] != "Y") {
            user.send("That's not a valid colour.");
            return;
        } else {
            var thumb;
            switch (card[2]) {
                case "B":
                    thumb = "blue.png"
                    break;
                case "G":
                    thumb = "green.png"
                    break;
                case "Y":
                    thumb = "yellow.png"
                    break;
                case "R":
                    thumb = "red.png"
                    break;
            }

            this.IterateUsers(function(me, iuser) {
                InformUser(me, iuser, "The colour has changed to `" + card[2] + "`", "#FFFF00", thumb);
            });
            if (card[1] == "4") {
                this.NextTurn(true);
                this.plusFourPlayer = user;

                this.plusFourChallengeSuccess = this.HasPlayableCards(user, false);
                this.resolvingPlusFour = true;
        
                var user = this.users[this.currentTurn];
                InformUser(this, user, "A player has played a Wild Draw Four, and you are the recipient. Use `!` to challenge, or `draw` to draw the cards.", "#FF0000");
                this.topCard = card;
                this.currentColor = card[2];
                return;
            }
            this.topCard = card;
            this.currentColor = card[2];
        }
    } else {
        this.topCard = card;
        this.currentColor = card[0];

        if (card[1] == "S") {
            this.NextTurn(true);
            var user = this.users[this.currentTurn];
            InformUser(this, user, "Your turn has been skipped.", "#FF0000", "skip.png");
            this.IterateUsers(function(me, iuser) {
                if (iuser.id != user.id) {
                    InformUser(me, iuser, user.username + "'s turn has been skipped.", "#FF0000", "skip.png");
                }
            });
        } else if (card[1] == "R") {
            if (this.direction == 0) {
                this.direction = 1;
            } else {
                this.direction = 0;
            }
            
            this.IterateUsers(function(me, iuser) {
                InformUser(me, iuser, "The direction of play has been reversed.", "#FFFF00", "reverse.png");
            });

            if (this.users.length == 2) {
                this.NextTurn(true);
            }
        } else if (card[1] == "+") {
            this.drawingCards += 2;
    
            if (this.houseRules.cumulativeDraw) {
                var deck = this.userDecks[this.users[this.NextPlayerIndex()].id];
                
                var hasDrawTwo = false;
                for (cardIndex in deck) {
                    var card = deck[cardIndex];
                    if (card[1] == "+") {
                        hasDrawTwo = true;
                    }
                }
    
                if (hasDrawTwo) {
                    if (this.userDecks[user.id].length == 0) {
                        this.IterateUsers(function(me, iuser) {
                            InformUser(me, iuser, "The game has ended. " + user.username + " has won this game.", "#FF0000");
                        });
                        this.Finalise();
                    } else if (this.userDecks[user.id].length == 1 && !this.didCallFFC) {
                        this.IterateUsers(function(me, iuser) {
                            InformUser(me, iuser, user.username + " has forgotten to call FFC! In the future you will be able to challenge this with the `!` command. For now however... go ban them somewhere or something.");
                        });
                    }
                
                    this.NextTurn();
                    return;
                }
            }

            if (this.userDecks[user.id].length == 0) {
                this.IterateUsers(function(me, iuser) {
                    InformUser(me, iuser, "The game has ended. " + user.username + " has won this game.", "#FF0000");
                });
                this.Finalise();
                this.NextTurn();
                return;
            }
    
            this.NextTurn(true);
            for (var i = 0; i < this.drawingCards; i++) {
                this.userDecks[this.users[this.currentTurn].id].push(GetRandomCard());
            }
    
            var user = this.users[this.currentTurn];

            var number = "";
            var file;
            switch (parseInt(this.drawingCards)) {
                case 2:
                    number = "two";
                    file = "draw2Card.png";
                    break;
                case 4:
                    number = "four";
                    file = "draw4Card.png";
                    break;
                case 6:
                    number = "six";
                    file = "draw6Card.png";
                    break;
                case 8:
                    number = "eight";
                    file = "drawCard.png";
                    break;
                default:
                    number = parseInt(this.drawingCards);
                    file = "drawCard.png";
            }
            InformUser(this, user, "You have been forced to draw " + number + " cards. Your turn is skipped.", "#FF0000", file);
            this.IterateUsers(function(me, iuser) {
                if (iuser.id != user.id) {
                    InformUser(me, iuser, user.username + " has been forced to draw " + number + " cards.", "#FF0000", file);
                }
            });
            this.drawingCards = 0;
        }
    }
    
    if (this.userDecks[user.id].length == 0) {
        this.IterateUsers(function(me, iuser) {
            InformUser(me, iuser, "The game has ended. " + user.username + " has won this game.", "#FF0000");
        });
        this.Finalise();
        return;
    } else if (this.userDecks[user.id].length == 1 && !this.didCallFFC) {
        this.IterateUsers(function(me, iuser) {
            InformUser(me, iuser, user.username + " has forgotten to call FFC! In the future you will be able to challenge this with the `!` command. For now however... go ban him somewhere or something.");
        });
    }

    this.NextTurn();
}

exp.prototype.CanPlayCard = function(card) {
    card = card.toUpperCase();
    var playable = false;
    var top = this.topCard;

    if ((card[0] == "+" && !(card.length == 3 || card.length == 2)) || (card[0] != "+" && card.length != 2)) {
        return "no";
    }
    
    if (this.drawingCards > 0) {
        if (card[1] == "+") {
            return "yes";
        } else {
            return "no";
        }
    }
    
    if (card[0] == "+") {
        if (card.length < 3) {
            return "wild";
        } else if (card[2] != "B" && card[2] != "G" && card[2] != "R" && card[2] != "Y") {
            return "wild";
        }
        playable = true;
    }
    
    if (card[0] == this.currentColor) {
        playable = true;
    }

    if (card[0] != "+" && card[1] == top[1]) {
        playable = true;
    }

    if (playable) {
        return "yes";
    } else {
        return "no";
    }
}

exp.prototype.NextTurn = function(skip = false) {
    this.justDrew = "";
    this.currentTurn = this.NextPlayerIndex();

    var user = this.users[this.currentTurn];
    if (!skip && !this.finished) {
        var embed = this.CreateEmbed(user, "It is now your turn.");
        embed.setColor("#00FF00");
        embed.addField("Current Card", this.topCard);

        var deck = this.userDecks[user.id];
        embed.addField("Hand", this.GetHandString(deck));
        
        user.send("", {embed: embed});
        this.didCallFFC = false;
    }
}

exp.prototype.NextPlayerIndex = function() {
    var index = this.currentTurn;
    if (this.direction == 0) {
        index++;
        if (index >= this.users.length ) {
            index = 0;
        }
    } else {
        index--;
        if (index < 0) {
            index = this.users.length - 1;
        }
    }
    return index;
}

exp.prototype.HasPlayableCards = function(user, includeWildcards = true) {
    var deck = this.userDecks[user.id];

    var playableCards = false;
    for (deckIndex in deck) {
        var card = deck[deckIndex];

        var canPlay = this.CanPlayCard(card);

        if (includeWildcards) {
            if (canPlay != "no") {
                playableCards = true;
            }
        } else {
            if (canPlay == "yes") {
                playableCards = true;
            }
        }
    }
    return playableCards;
}

function GetRandomCard() {
    var cards = [
        "R0",
        "Y0",
        "G0",
        "B0",
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
        "R6",
        "R7",
        "R8",
        "R9",
        "RR",
        "RS",
        "R+",
        "R1",
        "R2",
        "R3",
        "R4",
        "R5",
        "R6",
        "R7",
        "R8",
        "R9",
        "RR",
        "RS",
        "R+",
        "Y1",
        "Y2",
        "Y3",
        "Y4",
        "Y5",
        "Y6",
        "Y7",
        "Y8",
        "Y9",
        "YR",
        "YS",
        "Y+",
        "Y1",
        "Y2",
        "Y3",
        "Y4",
        "Y5",
        "Y6",
        "Y7",
        "Y8",
        "Y9",
        "YR",
        "YS",
        "Y+",
        "G1",
        "G2",
        "G3",
        "G4",
        "G5",
        "G6",
        "G7",
        "G8",
        "G9",
        "GR",
        "GS",
        "G+",
        "G1",
        "G2",
        "G3",
        "G4",
        "G5",
        "G6",
        "G7",
        "G8",
        "G9",
        "GR",
        "GS",
        "G+",
        "B1",
        "B2",
        "B3",
        "B4",
        "B5",
        "B6",
        "B7",
        "B8",
        "B9",
        "BR",
        "BS",
        "B+",
        "B1",
        "B2",
        "B3",
        "B4",
        "B5",
        "B6",
        "B7",
        "B8",
        "B9",
        "BR",
        "BS",
        "B+",
        "+W",
        "+W",
        "+W",
        "+W",
        "+4",
        "+4",
        "+4",
        "+4"
    ]

    return cards[Math.floor(Math.random() * 1000) % cards.length];
}

module.exports = exp;