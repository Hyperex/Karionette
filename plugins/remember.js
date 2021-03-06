// remembers things
"use strict";
var memDB = new DB.Json({filename: "remember"}),
	dunno = [
		"I dunno.",
		"no idea",
		"should I know?",
		"you tell me!",
		"no clue",
		"it's a mystery to all",
		"I *really* like pancakes...",
		"?!",
		"wat",
		"I don't know",
		"I'm not aware of such a thing"
	];

cmdListen({
	command: "remember",
	help: "remembers things so you don't have to. See also: memories, forget, wtf",
	syntax: config.command_prefix+"remember <memory handle> <as/are/is/were> <thing to remember> - Example: "
			+config.command_prefix+"remember Uni's pantsu as being striped white and blue.",
	callback: function (input) {
		var old,
			reg = /(.*) (as|is|are|were) (.*)/.exec(input.data);
		if (!reg) {
			irc.say(input.context, cmdHelp("remember", "syntax"));
			return;
		}
		old = memDB.getOne(reg[1]);
		memDB.saveOne(reg[1], [ reg[2], reg[3] ]);
		if (old) irc.say(input.context, "Updated - "+reg[1]+" "+reg[2]+" \""+reg[3]+"\"", false);
		else irc.say(input.context, "Added - "+reg[1]+" "+reg[2]+" \""+reg[3]+"\"", false);
	}
});

cmdListen({
	command: "memories",
	help: "lists memory handles. See also: remember, forget, wtf",
	syntax: config.command_prefix+"memories [-find <string>] - no arg to list memories"
		+" - Example: "+config.command_prefix+"memories -f pantsu",
	callback: function (input) {
		var memories, term,
			handles = [],
			ret = [];
		if (!input.args || !input.args[0]) {
			memories = Object.keys(memDB.getAll());
			if (memories.length > 0) {
				irc.say(input.context, "I have "+memories.length+" memories: "+memories.sort().join(", "), false);
			} else {
				irc.say(input.context, "I..I don't remember anything. ;~;");
			}
			return;
		}
		switch (input.args[0]) {
			case "-f":
			case "-find":
				if (!input.args[1]) {
					irc.say(input.context, cmdHelp("memories", "syntax"));
					return;
				}
				term = input.args.slice(1).join(" ");
				memories = memDB.getAll();
				Object.keys(memories).forEach(function (memory) {
					if (memory.indexOf(term) > -1) handles.push(memory);
					else if (memories[memory][1].indexOf(term) > -1) ret.push(memory);
				});
				if (handles.length === 0 && ret.length === 0) {
					irc.say(input.context, "No matches. :<");
				} else {
					if (handles.length > 0) {
						irc.say(input.context, "Memory handles matching \""+term+"\": "+handles.join(", "), false);
					}
					if (ret.length > 0) {
						irc.say(input.context, "Memories matching \""+term+"\": "+ret.join(", "), false);
					}
				}
				break;
			default:
				irc.say(input.context, cmdHelp("memories", "syntax"));
				break;
		}
	}
});

cmdListen({
	command: "forget",
	help: "forgets .. what was I doing? See also: remember, memories, wtf",
	syntax: config.command_prefix+"forget <memory handle>",
	callback: function (input) {
		if (!input.args || !input.args[0]) {
			irc.say(input.context, cmdHelp("forget", "syntax"));
			return;
		}
		if (memDB.getOne(input.data)) {
			memDB.removeOne(input.data);
			irc.say(input.context, "I've forgotten all about "+input.data, false);
		} else {
			irc.say(input.context, "I don't remember "+input.data+" in the first place.. :\\ - try \""
				+config.command_prefix+"memories\" for a list.", false);
		}
	}
});

cmdListen({
	command: "wtf",
	help: "wtf is wtf? See also: remember, memories, forget",
	syntax: config.command_prefix+"wtf <is/are/was/were> <memory handle> - Example: "
			+config.command_prefix+"wtf is the colour of ranma's pantsu",
	callback: function (input) {
		var reg, memory;
		if (!input.args || !input.args[0] || !input.args[1]) {
			irc.say(input.context, cmdHelp("wtf", "syntax"));
			return;
		}
		reg = /(were|are|was|is) (.*)/.exec(input.data);
		memory = memDB.getOne(reg[2]);
		if (!memory) {
			irc.say(input.context, lib.randSelect(dunno));
			return;
		}
		irc.say(input.context, [ reg[2], memory[0], memory[1] ].join(" "), false);
	}
});

