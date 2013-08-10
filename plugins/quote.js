// collects quotes
var quoteDB = new DB.Json({filename: "quotes"});

function zero(n) {
	return (n > 9 ? n : "0"+n);
}

function makeTime(time) {
	time = new Date(time);
	return zero(time.getDate())+"/"+zero(time.getMonth()+1)+"/"+time.getYear().toString().slice(1);
}

listen({
	plugin: "quote",
	handle: "quote",
	regex: regexFactory.startsWith("quote"),
	command: {
		root: "quote",
		options: "add, remove, find, get, random",
		help: "Quote added by mitchplz on 24/07/13: <mitch_> should I into quotes",
		syntax: "[Help] Syntax: "+config.command_prefix+"quote <add/remove> <mitch_> huurrr memes - quote find <search term> - quote random"
	},
	callback: function (input, match) {
		var i, k, quote, quotes, tmp, first, matches, time,
			args = match[1].split(" ");
		if (input.context[0] !== "#") {
			irc.say(input.context, "You can only use this in a channel for now, sorry.");
			return;
		}
		switch (args[0]) {
			case "add":
				if (!args[1]) { irc.say(input.context, this.command.syntax); return; }
				quote = { quote: args.slice(1).join(" ") };
				quotes = quoteDB.getOne(input.context);
				if (!quotes) {
					quotes = [];
					quote.num = 1;
				} else { // make sure there are no duplicates
					quote.num = quotes.length+1;
					for (i = 0; i < quotes.length; i++) {
						if (quotes[i].quote === quote.quote) {
							tmp = quotes[i].from.split("!")[0];
							tmp = (tmp.toLowerCase() === input.from.toLowerCase() ? "you" : tmp);
							irc.say(input.context, "That quote was already added "+lib.duration(new Date(quotes[i].date))+" ago by "+tmp+".");
							return;
						}
					}
				}
				quote.from = input.user;
				quote.date = new Date();
				quotes.push(quote);
				quoteDB.saveOne(input.context, quotes);
				irc.say(input.context, "Added o7");
				break;
			case "remove":
				if (!args[1]) { 
					irc.say(input.context, "[Help] Syntax: "+config.command_prefix+
						"quote remove <quote ID/actual quote text> - Example: "+config.command_prefix+
						"quote remove <mitch_> I loooove me some memes. / "+config.command_prefix+
						"quote remove 7");
					return;
				}
				quotes = quoteDB.getOne(input.context);
				if (!quotes || quotes.length === 0) {
					irc.say(input.context, "There aren't any quotes for "+input.context+" ~ add some!");
					return;
				}
				if (args[1].match(/[0-9]+/) && !args[2]) {
					args[1] = parseInt(args[1]);
					if (args[1] > quotes.length) {
						irc.say(input.context, "There are only "+quotes.length+" quotes in here.");
						return;
					}
					tmp = [];
					
					for (i = 0, k = 0; i < quotes.length; i++) {
						if (quotes[i].num === args[1]) {
							irc.say(input.context, "Removed quote: \""+quotes[i].quote+
								"\" ~ which was added by "+quotes[i].from+" on "+makeTime(quotes[i].date)+".");
						} else {
							k++;
							quotes[i].num = k; // renumber entries
							tmp.push(quotes[i]);
						}
					}
					if (tmp.length === 0) quoteDB.removeOne(input.context);
					else quoteDB.saveOne(input.context, tmp);
					return;
				}
				quote = args.slice(1).join(" ");
				for (i = 0; i < quotes.length; i++) {
					if (quotes[i].quote === quote) {
						tmp = [];
						quotes.forEach(function (entry) {
							if (entry.quote !== quote) tmp.push(entry);
						});
						if (tmp.length === 0) quoteDB.removeOne(input.context);
						else quoteDB.saveOne(input.context, tmp);
						irc.say(input.context, "Removed o7");
						return;
					}
				}
				irc.say(input.context, "Couldn't find it. :\\");
				break;
			case "find":
				if (!args[1]) {
					irc.say(input.context, "[Help] Syntax: "+config.command_prefix+
						"quote find <string> - returns a random quote which contains string - Example: "+config.command_prefix+
						"quote find butts");
					return;
				}
				quotes = quoteDB.getOne(input.context);
				if (!quotes || quotes.length === 0) {
					irc.say(input.context, "There aren't any quotes for "+input.context+" ~ add some!");
					return;
				}
				quote = args.slice(1).join(" ");
				for (matches = [], i = 0; i < quotes.length; i++) {
					if (quotes[i].quote.indexOf(quote) > -1) {
						matches.push(quotes[i]);
					}
				}
				if (!matches.length) {
					irc.say(input.context, "No match found.");
					return;
				}
				i = Math.floor(Math.random()*matches.length);
				time = makeTime(matches[i].date);
				irc.say(input.context, (matches.length > 1 ? "("+matches.length+" matches) " : "")+
					"Quote #"+matches[i].num+" added by "+matches[i].from.split("!")[0]+" on "+time+": "+matches[i].quote);
				break;
			case "get":
				quotes = quoteDB.getOne(input.context);
				if (!quotes || quotes.length === 0) {
					irc.say(input.context, "There aren't any quotes for "+input.context+" ~ add some!");
					return;
				}
				if (!args[1] || !args[1].match(/[0-9]+/) || parseInt(args[1]) > quotes.length) {
					irc.say(input.context, "You have "+quotes.length+" quotes to choose from - try "+config.command_prefix+
						"quote get "+Math.floor(Math.random()*quotes.length+1)+".");
					return;
				}
				for (i = 0; i < quotes.length; i++) {
					if (quotes[i].num === parseInt(args[1])) {
						irc.say(input.context, "Quote #"+quotes[i].num+" added by "+quotes[i].from.split("!")[0]+
							" on "+makeTime(quotes[i].date)+": "+quotes[i].quote);
						return;
					}
				}
				break;
			case "random":
				quotes = quoteDB.getOne(input.context);
				if (!quotes || quotes.length === 0) {
					irc.say(input.context, "There aren't any quotes for "+input.context+" ~ add some!");
					return;
				}
				quote = lib.randSelect(quotes);
				irc.say(input.context, "Quote #"+quote.num+" added by "+quote.from.split("!")[0]+
					" on "+makeTime(quote.date)+": "+quote.quote);
				break;
			case "stats":
				quotes = quoteDB.getOne(input.context);
				if (!quotes || quotes.length === 0) {
					irc.say(input.context, "There aren't any quotes for "+input.context+" ~ add some!");
					return;
				}
				tmp = [];
				quotes.forEach(function (entry) {
					entry = entry.from.split("!")[0];
					if (!tmp.some(function (item) { return (entry === item); })) {
						tmp.push(entry);
					}
				});
				irc.say(input.context, "There are "+quotes.length+" quotes for "+input.context+
					", added by "+tmp.length+" "+(tmp.length > 1 ? "people." : "person."));
				break;
			default:
				irc.say(input.context, this.command.syntax);
				break;
		}
	}
});

