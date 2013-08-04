/*
 * EVENTPIPE: This module binds events to the listeners collection,
 *			  and fires the appropriate event(s) for received data.
 */
var DB = require('./lib/fileDB.js'),
	regexFactory = require('./lib/regexFactory');

module.exports = (function () {
	var keyCache, aliasVars,
		listeners = {},
		aliasEventlets = [],
		isInAlias = false,
		maxEventFire = 10,
		aliasDB = new DB.Json({filename: "alias/alias"}),
		varDB = new DB.Json({filename: "alias/vars"}),
		randThings = new DB.List({filename: "randomThings"}).getAll();
	
	// Re-populate the keyCache
	function setHandles() {
		keyCache = Object.keys(listeners);
	}
	
	// Create the supplant object for alias vars
	function makeVars(match, context, from) {
		var i, args, newMatch;
		var nicks = (context[0] === "#" ? ial.Active(context) : []),
			nicks = (nicks.length > 0 ? nicks : [ "someone", "The Lawd Jasus", "your dad", "mitch_", "Asuna" ]),
			av = lib.mix(varDB.getAll(), {
					"{me}": irc_config.nick,
					"{from}": from,
					"{channel}": context,
					"{randThing}": randThings[Math.floor(Math.random() * randThings.length)],
					"{randNick}": nicks[Math.floor(Math.random() * nicks.length)],
					"{args1}": "",
					"{args2}": "",
					"{args3}": "",
					"{args*}": "",
					"{args-1}": "",
					"{args1*}": "",
					"{args2*}": "",
					"{args3*}": ""
				}, false);
		if (match[1]) {
			newMatch = lib.supplant(match[1], av);
			args = newMatch.split(" ");
			av["{args*}"] = newMatch;
			av["{args-1}"] = args[args.length - 1];
			for (i = 0; i < args.length; i += 1) {
				av["{args" + (i + 1) + "*}"] = args.slice(i).join(" ");
				av["{args" + (i + 1) + "}"] = args[i];
			}
		}
		return av;
	}
	
	// Evaluates alias strings
	function evaluateAlias(aliasString, aliasVars) {
		return lib.supplant(aliasString, aliasVars);
	}
	
	// Check if the data contains an aliased command
	function transformAlias(input) {
		var i, toTransform, aliasMatch, aliasVars,
			aliasKeys = aliasDB.getKeys();
		for (i = 0; i < aliasKeys.length; i += 1) {
			aliasMatch = regexFactory.startsWith(aliasKeys[i]).exec(input.raw);
			if (aliasMatch) {
				aliasVars = makeVars(aliasMatch, input.context, input.from);
				toTransform = evaluateAlias(aliasDB.getOne(aliasKeys[i]), aliasVars);
				if (aliasMatch[1]) {
					input.raw = input.raw.slice(0, -(aliasMatch[1].length) - 1);
				}
				input.raw = input.raw.replace(
					new RegExp("("+irc_config.command_prefix+"|"
						+irc_config.nickname.join("[:,-]? |")+"[:,-]? )"+aliasKeys[i],"i")
						,irc_config.command_prefix + toTransform);
				return input.raw;
			}
		}
		return input.raw;
	}
	
	// Check if the data fires a plugin, and then do so
	function fireEvent(input) {
		transformAlias(input);
		keyCache.forEach(function (element) {
			var permission,
				match = listeners[element].regex.exec(input.raw);
			if (match) {
				permission = true;
				if (listeners[element].plugin && input.user) {
					permission = permissions.Check("plugin", listeners[element].plugin, input.user);
				}
				if (permission) {
					try {
						listeners[element].callback(input, match);
					} catch (err) {
						logger.error("Caught error in listener " + element + ": " + err);
					}
					if (listeners[element].once) {
						delete listeners[element];
						setHandles();
					}
				} else {
					logger.info("Denied " + input.from + " access to " + listeners[element].plugin + " plugin.");
				}
			}
		});
	}
	
	return {
		bind: function (evParams) {
			// Error handling
			if (!(evParams.handle && evParams.regex && evParams.callback) || toString.call(evParams.regex) !== '[object RegExp]') {
				logger.error("Script handle " + evParams.handle + ": listen method requires an object with handle, (valid!) regex and callback properties.");
				return;
			}
			// Default values
			evParams.once = evParams.once || false;
			evParams.prefixed = evParams.prefixed || true;
			evParams.command = evParams.command || null;
			evParams.alias = evParams.alias || null;
			
			// Fill listener object
			listeners[evParams.handle] = {
				plugin: evParams.plugin,
				regex: evParams.regex,
				callback: evParams.callback,
				once: evParams.once,
				cmdPrefix: evParams.prefixed,
				command: evParams.command
			};
		},
		fire: fireEvent,
		purge: function (key) {
			delete listeners[key];
			setHandles();
		},
		purgeOne: function (plugin) {
			// delete any listeners belonging to plugin
			var keys = Object.keys(listeners),
				cmds = [];
			keys.forEach(function (listener) {
				if (listeners[listener].plugin.toLowerCase() === plugin.toLowerCase()) {
					delete listeners[listener];
				}
			});
		},
		purgeAll: function () {
			listeners = {};
			keyCache = [];
		},
		getCommand: function (key) {
			return listeners[key].command;
		},
		getCommands: function () {
			var i, commands = [];
			for (i = 0; i < keyCache.length; i += 1) {
				if (listeners[keyCache[i]].command) {
					commands.push(listeners[keyCache[i]].command);
				}
			}
			return commands;
		},
		addEventlet: function (eventlet) {
			aliasEventlets.push(eventlet);
		},
		isInAlias: isInAlias,
		setHandles: setHandles
	}
}());
