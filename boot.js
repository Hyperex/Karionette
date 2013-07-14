globals = {
	lastError: "",
	lastWarning: "",
	admins: { lastCheck: new Date().getTime() },
	channels: {},
	startTime: new Date(),
	memProf: { "loading requires": process.memoryUsage().rss }
};

require("./lib/funcs.js");
require("./lib/logger.js");
require("./lib/ial.js");
require("./lib/permissions.js");
require("./config.js");

var DB = require("./lib/fileDB.js"),
	web = require("./lib/web.js"),
	regexFactory = require("./lib/regexFactory.js"),
	Eventpipe = require("./eventpipe.js"),
	Connection = require("./connection.js"),
	Plugin = require("./plugin.js"),
	repl = require('repl');
lib.memProf("loading requires");

function createSandbox() {
	return {
		irc: IRC,
		config: irc_config,
		console: console,
		setTimeout: setTimeout,
		setInterval: setInterval,
		web: web,
		DB: DB,
		lib: lib,
		ial: ial,
		require: require,
		regexFactory: regexFactory,
		listen: Eventpipe.bind,
		logger: logger,
		permissions: permissions,
		globals: globals
	};
}

var IRC = global.mari = new Connection(Eventpipe);
IRC.reload = function (plugin) {
	console.log("IRC.reload("+plugin+") called");
	if (!plugin) {
		Eventpipe.purgeAll();
		Plugin.loadAll(createSandbox());
		Eventpipe.setHandles();
	} else {
		Eventpipe.purgeOne(plugin);
		Plugin.loadOne(createSandbox(), plugin);
		Eventpipe.setHandles();
	}
};

process.on('uncaughtException', function (err) {
	logger.error("Uncaught Exception: " + err);
});

Plugin.loadAll(createSandbox());
Eventpipe.setHandles();

IRC.open({
	server: irc_config.server,
	port: irc_config.port,
	nickname: irc_config.nickname[0],
	username: irc_config.username,
	realname: irc_config.realname
});

repl.start({ prompt: '', ignoreUndefined: true });
