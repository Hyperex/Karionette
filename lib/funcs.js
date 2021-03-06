﻿"use strict";
// General Helpers
var memProfcache = {},
	timedCache = {},
	memuseLast = process.memoryUsage().rss,
	firstHit = function (arr) {
		var i;
		for (i = 0; i < arr.length; i++) {
			if (arr[i].length > 0) return arr[i];
		}
		return "[no valid arg]";
	},
	plural = function (n, word) {
		return (n > 1 || n === 0 ? word+"s" : word);
	},
	space = function (text, len) {
		var ret = "",
			diff = len-text.length;
		while (diff > 0) {
			ret = ret+" ";
			diff--;
		}
		return ret+text;
	},
	inteSupp = function (str, obj) {
		//return str.replace(/(\{\w*((?:-\d)|\*)?\})/gi, function (a, b) {
		// HI DEIDE. I don't understand this ^ so I made this v
		// Sorry if it's broken. seems ok?!
		return str.replace(/(\{[^\{\}\(\)\[\] ]+\})/g, function (a, b) {
			return typeof obj[b] === 'string' ? obj[b] : a;
		});
	};

global.lib = {
	events: new process.EventEmitter(),
	supplant: function (string, o, n) {
		'use strict';
		var i, result;
		n = n || 1;
		for (i = 0; i < n; i += 1) {
			result = inteSupp(string, o);
		}
		if (result.match(/\{\((.*\|?)\)\}/)) {
			result = this.parseVarList(result);
		}
		if (result.match(/\{\[(.*\|?)\]\}/)) {
			return this.molest(result);
		}
		return result;
	},
	randVarListItem: function (match) {
		return this.randSelect(match.slice(2, -2).split(/\s?\|\s?/));
	},
	parseVarList: function (str) {
		// Errryday I'm fondlin'
		var result, regex, i;
		regex = /\{\([^\{]*?[^\(]*?\)\}/g;
		result = str.replace(regex, this.randVarListItem.bind(this));
		if (result.match(regex)) {
			return this.parseVarList(result);
		}
		if (result.indexOf("  ") > -1) {
			// double spaces! >:( HULK SMASH
			result = result.split(" ");
			for (i = 0; i < result.length; i++) {
				if (result[i].length === 0) result.splice(i, 1);
			}
			result = result.join(" ");
		}
		return result;
	},
	molest: function (result) {
		var reg,
			res2 = result;
		
		while ((reg = /(\{\[(.*?|)\]\})/.exec(res2))) {
			reg[2] = reg[2].split('|');
			result = result.replace(reg[1], firstHit(reg[2]).trim());
			res2 = res2.slice(res2.indexOf(reg[1])+reg[1].length+1);
		}
		if (result.indexOf("  ") > -1) {
			res2 = result.split(" "), result = [];
			res2.some(function (item) {
				if (item.length > 0) result.push(item);
			});
			result = result.join(" ");
		}
		res2 = null, reg = null;
		return result;
	},
	mix: function (from, to, overwrite) {
		var property;
		for (property in from) {
			if (!to[property] || overwrite) {
				to[property] = from[property];
			}
		}
		return to;
	},
	stripHtml: function stripHtml(text) {
		var ret = "";
		text = text.replace(/\n/g, "").replace(/<[^<]+?>/g, "");
		text = text.trim();
		text.split(" ").forEach(function (entry) {
			if (entry.length > 0) ret = ret+entry+" ";
		});
		return ret.slice(0,-1);
	},
	randSelect: function (yarr) {
		return yarr.length > 1 ?
				yarr[~~(Math.random() * yarr.length)] : yarr[0];
	},
	randNum: function (min, max) {
		var n;
		if (!max || min > max) return Math.floor(Math.random()*min);
		n = 0;
		while (n < min) {
			n = Math.floor(Math.random()*max);
		}
		return n;
	},
	chance: function (n) {
		return (Math.floor(Math.random()*100) <= (n ? n : 50));
	},
	nodeVersion: function () {
		return "I am running Node.js "+process.version+" on "+process.platform+".";
	},
	memUse: function (raw) {
		if (raw) return process.memoryUsage().rss;
		return (((process.memoryUsage().rss) / 1024) / 1024).toString().slice(0, 5);
	},
	memProf: function (desc) {
		var diff;
		if (!memProfcache[desc]) {
			memProfcache[desc] = process.memoryUsage().rss;
			return;
		}
		diff = (process.memoryUsage().rss - memProfcache[desc]);
		if (diff > 0) {
			console.log(this.timestamp(desc+" added "+this.commaNum((diff/1024))+" KiB."));
		} else if (diff < 0) {
			console.log(this.timestamp(desc+" freed "+this.commaNum((diff/1024).toString().slice(1))+" KiB."));
		}
		delete memProfcache[desc];
		diff = null;
	},
	memReport: function() {
		var memuse = process.memoryUsage().rss,
			report, diff;
		if (memuse !== memuseLast) {
			report = this.commaNum((memuse/1024));
			diff = ((memuse-memuseLast)/1024);
			if (diff > 0) {
				diff = " [+"+space(this.commaNum(diff), 5)+" KiB]";
			} else {
				diff = " [-"+space(this.commaNum(diff.toString().slice(1)), 5)+" KiB]";
			}
			logger.memr(report+" KIB"+diff);
			memuseLast = memuse;
		}
		memuse = null; report = null; diff = null;
	},
	timeReport: function(handle) {
		var diff, now;
		if (!timedCache[handle]) {
			timedCache[handle] = new Date().valueOf();
			return;
		}
		now = new Date().valueOf();
		diff = (now-timedCache[handle]);
		logger.debug(handle+" took "+diff+"ms");
		diff = null; now = null;
		delete timedCache[handle];
	},
	commaNum: function (n) {
		return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	},
	datestamp: function () {
		var month, day, year,
			date = new Date();
		month = (date.getMonth()+1).toString();
		month = (month > 9 ? month : "0"+month);
		day = date.getDate();
		day = (day > 9 ? day : "0"+day);
		year = date.getYear().toString().slice(1);
		return day+"/"+month+"/"+year;
	},
	timestamp: function (line) {
		if (line) return "[" + new Date().toTimeString().slice(0,8) + "] " + line;
		return "[" + new Date().toTimeString().slice(0,8) + "]";
	},
	duration: function (basetime, altTime) {
		var secs = Math.floor(((altTime || new Date())-basetime)/1000),
			mins = Math.floor(secs / 60),
			hours = Math.floor(mins / 60),
			days = Math.floor(hours / 24),
			years = Math.floor(days / 365.25),
			duration = "";
		secs = (secs % 60);
		mins = (mins % 60);
		hours = (hours % 24);
		days %= 365.25;
		if (years) duration = years+plural(years, " year")+", ";
		if (days) duration += days+plural(days, " day")+", ";
		if (hours) duration += hours+plural(hours, " hour")+", ";
		if (mins) duration += mins+plural(mins, " minute")+" and ";
		duration += secs+plural(secs, " second");
		return duration;
	}
};

