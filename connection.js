﻿"use strict";
/*
 * CONNECTION: This module handles connection to the IRC server,
 * 			   as well as sending and receiving data from it.
 */
require("./lib/ial.js");
var net = require("net"),
	fs = require("fs");
	
//module.exports = function (Eventpipe) {
module.exports = function () {
	var connected = false,
		connectInterval,
		socket = new net.Socket(),
		buffer = {
			ob: new Buffer(4096),
			size: 0
		};
	
	// Handles incoming data
	function dataHandler(data) {
		caveman.emitEvent(data);
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
		socket.write(data + "\r\n", "utf8", function () {
			if (!silent) logger.sent(data);
		});
	}
	
	// Configure the socket appropriately
	function configureSocket() {
		socket.setNoDelay(true);
		socket.setEncoding("utf8");
		// Connection TimeOut support
		socket.setTimeout(300 * 1000, function socketTimeout() {
			// If fails, error and close events trigger
			//logger.warn("Socket Timeout...");
			send("VERSION");
			socket.destroy();
		});
		socket.on("close", function socketCloseEvent(hadError) {
			if (!(hadError || connected)) {
				process.emit("closing");
				logger.warn("Socket closed. Exiting process...");
				socket.end();
				setTimeout(function () {
					process.exit();
				}, 1000);
			} else {
				logger.warn("Socket closed. Attempting to reconnect in 15 seconds...");
				socket = new net.Socket();
				if (!connectInterval) {
					connectInterval = setInterval(function () {
						logger.warn("Attempting reconnect...");
						openConnection({
							server: irc_config.server,
							port: irc_config.port,
							nickname: irc_config.nickname[0],
							username: irc_config.username,
							realname: irc_config.realname
						});
					}, 15000);
				}
			}
		});
		socket.on("error", function socketErrorEvent(e) {
			logger.error("Socket error!", e);
			socket.destroy();
		});
		socket.on("data", dataBuffer);
	}
	
	function openConnection(params) {
		configureSocket();
		socket.connect(params.port, params.server, function () {
			send("NICK " + sanitise(params.nickname));
			send("USER " + sanitise(params.username) + " localhost * " + sanitise(params.realname));
			connected = true;
			if (connectInterval) {
				clearInterval(connectInterval);
				connectInterval = null;
			}
		});
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
		open: openConnection,
		quit: function quitConnection(msg) {
			connected = false;
			msg = msg || irc_config.quit_msg;
			send("QUIT :" + msg);
			socket.end();
		},
		raw: function (stuff) {
			send(stuff);
		},
		// IRC COMMANDS
		pong: function (server) {
			send("PONG :" + server, true);
		},
		join: function (channel, key) {
			if (key) {
				send("JOIN "+sanitise(channel)+" "+sanitise(key));
			} else {
				send("JOIN "+sanitise(channel));
			}
		},
		part: function (channel, reason) {
			if (reason) {
				send("PART "+sanitise(channel)+" :"+sanitise(reason));
			} else {
				send("PART "+sanitise(channel));
			}
		},
		say: function (context, message, sanitiseMessage, maxmsgs) {
			var privmsg, max, maxMessages, i, tempMsg;
			if (!context || !message) return;
			message = message.replace(/\n|\t|\r/g, "");
			context = sanitise(context); // Avoid sanitising more than once
			privmsg = "PRIVMSG " + context + " :";
			if (irc_config.address) {
				max = 508 - (irc_config.nick+irc_config.address+privmsg).length+3;
			} else {
				max = 473 - privmsg.length; // yay magic numbers - haven't joined a channel yet.
			}
			maxMessages = (maxmsgs < 3 ? maxmsgs : 3);
			if (sanitiseMessage !== false) {
				message = sanitise(message);
			}
			while (message && (maxMessages -= 1) >= 0) {
				i = 0;
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
		},
		reply: function (input, message, sanitiseReply) {
			if (input && message) {
				if (sanitiseReply !== false) {
					this.say(input.context, input.from + ": " + message);
				} else {
					this.say(input.context, input.from + ": " + message, false);
				}
			}
		},
		action: function (channel, action, sanitiseAction) {
			if (channel && action) {
				action = action.replace(/\n|\t|\r/g, "");
				if (sanitiseAction !== false) {
					this.say(channel, "\x01ACTION "+sanitise(action)+"\x01", false);
				} else {
					this.say(channel, "\x01ACTION "+action+"\x01", false);
				}
			}
		},
		notice: function (target, notice) {
			if (target && notice) {
				notice = notice.replace(/\n|\t|\r/g, "");
				send("NOTICE " + sanitise(target) + " :" + sanitise(notice));
			}
		},
		// CORE COMMANDS
		reload: function () {}
	}
};

