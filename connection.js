﻿/* 
 * CONNECTION: This module handles connection to the IRC server,
 * 			   as well as sending and receiving data from it.
 */
require("./lib/ial.js");
var net = require("net"),
	fs = require("fs"),
	DB = require("./lib/fileDB.js");
	
module.exports = function (Eventpipe) {
	var socket = new net.Socket(),
		ignoreDB = new DB.List({filename: "ignore"}),
		buffer = {
			ob: new Buffer(4096),
			size: 0
		};

	// Handles incoming data
	function dataHandler(data) {
		var regArr,
			ignore = false,
			input = {
				raw: data,
				from: "",
				host: "",
				user: "",
				context: "",
				data: ""
			};
		// Log the data if not a ping
		logger.filter(data);
		// Check it's a PRIVMSG in a context
		if (data.indexOf('PRIVMSG') > -1) {
			regArr = (/^:([^!]+)!([^ ]+@[^ ]+) PRIVMSG ([^ ]+) :(.*)$/i).exec(data);
			if (regArr) {
				input.from = regArr[1];
				input.host = regArr[2];
				input.data = regArr[4];
				input.user = regArr[1]+"!"+regArr[2];
				// Reply to PMs
				input.context = (regArr[3][0] === '#') ? regArr[3] : input.from;
				// Check if 'from' should be ignored
				if (ignoreDB.getOne(input.from, true)) ignore = true;
				else {
					ignoreDB.getAll().some(function (entry) {
						if (ial.maskMatch(input.user, entry)) {
							ignore = true;
						}
					});
				}
				if (ignore) return;
				regArr = /^;([^ ]+)/.exec(input.data);
				if (regArr) {
					var matches = permissions.Search(regArr[1]),
						permission = true;
					if (matches.length > 0) {
						matches.forEach(function (entry) {
							permission = permissions.Check(entry[0], entry[1], input.user);
						});
						if (!permission) {
							logger.info("Denied "+input.from+" access to "+regArr[1]);
							return;
						}
					}
				}
			}
		}
		// Fire any events
		Eventpipe.fire(input);
	}

	// Utilise a Buffer on the data - this can also be used to catch data before it's handled
	function dataBuffer(data) {
		var newlineIdx;
		data = data.replace(/\r/g, "");
		while ((newlineIdx = data.indexOf("\n")) > -1) {
			if (buffer.size > 0) {
				data = buffer.ob.toString("utf8", 0, buffer.size) + data;
				newlineIdx += buffer.size;
				buffer.size = 0;
			}
			dataHandler(data.substr(0, newlineIdx));
			data = data.slice(newlineIdx + 1);
		}
		if (data.length > 0) {
			buffer.ob.write(data, buffer.size, "utf8");
			buffer.size += data.length;
		}
	}

	// Send a message via the open socket
	function send(data, silent) {
		if (!data || data.length === 0) {
			logger.error("Tried to send no data");
			return;
		}
		if (data.length > 510) {
			logger.error("Tried to send data > 510 chars in length: " + data);
			return;
		}
		socket.write(data + '\r\n', 'utf8', function () {
			if (!silent) logger.sent(data);
		});
	}

	// Configure the socket appropriately
	function configureSocket() {
		socket.setNoDelay(true);
		socket.setEncoding("utf8");
		// Connection TimeOut support
		socket.setTimeout(240 * 1000, function () {
			// If fails, error and close events trigger
			send("VERSION");
		});
		socket.on("close", function () {
			process.emit("closing");
			setTimeout(function () {
				process.exit();
			}, 1000);
		});
		socket.on("data", dataBuffer);
	}

	// Sanatise a string for use in IRC
	function sanitise(string) {
		if (!string) {
			return string;
		}
		/* Note:
		* 0x00 (null character) is invalid
		* 0x01 signals a CTCP message, which we shouldn't ever need to do
		* 0x02 is bold in mIRC (and thus other GUI clients)
		* 0x03 precedes a color code in mIRC (and thus other GUI clients)
		* 0x04 thru 0x19 are invalid control codes, except for:
		* 0x16 is "reverse" (swaps fg and bg colors) in mIRC
		*/
		return string.replace(/\n/g, "\\n").replace(/\r/g, "\\r")
			.replace(/[^\x02-\x03|\x16|\x20-\x7e]/g, "");
	}

	return {
		open: function (params) {
			configureSocket();
			socket.connect(params.port, params.server, function () {
				send("NICK " + sanitise(params.nickname));
				send("USER " + sanitise(params.username) + " localhost * " + sanitise(params.realname));
			});
		},
		quit: function () {
			send("QUIT");
		},
		raw: function (stuff) {
			send(stuff);
		},
		// IRC COMMANDS
		pong: function (server) {
			send("PONG :" + server, true);
		},
		join: function (channel, key) {
			if (channel) {
				var cmd = "JOIN :" + sanitise(channel);
				if (key) {
					cmd += " " + sanitise(key);
				}
				send(cmd);
			}
		},
		part: function (channel) {
			send("PART :" + sanitise(channel));
		},
		say: function (context, message, sanitiseMessage) {
			var privmsg, max, maxMessages;
			if (context && message) {
				context = sanitise(context); // Avoid sanitising more than once
				privmsg = "PRIVMSG " + context + " :";
				if (irc_config.address) {
					max = 510 - (irc_config.nick.length+irc_config.address.length+3+privmsg.length);
				} else {
					max = 473 - privmsg.length; // yay magic numbers - haven't joined a channel yet.
				}
				maxMessages = 3;
				if (sanitiseMessage !== false) {
					message = sanitise(message);
				}
				if (Eventpipe.isInAlias === false) {
					while (message && (maxMessages -= 1) >= 0) {
						var i = 0;
						tempMsg = message.slice(0, max);
						if (message.length > tempMsg.length) {
							max = max-3;
							while (message[max - i] !== " ") {
								i += 1;
							}
							tempMsg = message.slice(0, (max - i)) + " ..";
						}
						send(privmsg + tempMsg.trim());
						message = message.slice(max - i);
					}
				} else {
					Eventpipe.addEventlet(message);
				}
			}
		},
		reply: function (input, message) {
			this.say(input.context, input.from + ": " + message);
		},
		action: function (channel, action) {
			if (channel && action) {
				send("PRIVMSG " + sanitise(channel) + " :\x01ACTION " + sanitise(action) + "\x01");
			}
		},
		notice: function (target, notice) {
			if (target && notice) {
				send("NOTICE " + sanitise(target) + " :" + sanitise(notice));
			}
		},
		// CORE COMMANDS
		reload: function () {},
		help: function () {
			return Eventpipe.getCommands();
		},
		ignore: function (user) {
			ignoreDB.saveOne(user);
		},
		unignore: function (user) {
			ignoreDB.removeOne(user, true);
		},
		ignoreList: function () {
			return (ignoreDB.getAll().join(", ") || "Ignoring no one ;)");
		}
	}
}
