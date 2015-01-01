var spawn = require('child_process').spawn,
	EventEmitter = require('events').EventEmitter;

module.exports = function (username, password) {
	var spawnSic = function () {
			var sic = spawn('sic', ['-h', 'irc.ppy.sh', '-n', username, '-k', password]);
			sic.stdout.on('data', function (data) {
				inst.emit('raw', data);
			});
			sic.stdout.on('end', function () {
				inst.emit('end');
			});
			return sic;
		},
		message = (function () {
			var queue = [],
				timeout = null,
				dispatch = function () {
					var msg = queue.pop();
					if (msg) {
						sic.stdin.write(':m ' + msg.to + ' ' + msg.text + '\n');
						timeout = setTimeout(dispatch, 2000);
					} else {
						timeout = null;
					}
				};
			return function (to, text) {
				queue.push({ to: to, text: text });
				if (timeout === null) {
					dispatch();
				}
			};
		})(),
		inst = new EventEmitter(),
		messageTypes = {
			'r-message': RegExp(username + '\\s+: \\d+/\\d+/\\d+ \\d+:\\d+ <(.*)> (.*)'),
			'r-auth': RegExp('cho\\.ppy\\.sh\\s+: \\d+/\\d+/\\d+ \\d+:\\d+ >< \\d+ \\(' + username + '\\): - (http://osu.ppy.sh/p/ircauth?action=allow&nick=.+&ip=\\d+\\.\\d+\\.\\d+\\.\\d+)'),
			'r-nosuchnick': RegExp('cho\\.ppy\\.sh\\s+: \\d+/\\d+/\\d+ \\d+:\\d+ >< \\d+ \\(' + username + ' (.*)\\): No such nick'),
			'ready': RegExp('cho\\.ppy\\.sh\\s+: \\d+/\\d+/\\d+ \\d+:\\d+ >< \\d+ \\(' + username + '\\): - To get started try joining #osu!'),
			'badauth': RegExp('cho\\.ppy\\.sh\\s+: \\d+/\\d+/\\d+ \\d+:\\d+ >< \\d+ \\(' + username + ' ' + username + '\\): Bad authentication token.')
		},
		sic;

	inst.on('end', function () {
		sic = spawnSic();
		inst.emit('respawn');
	});
	inst.on('raw', function (data) {
			var type = null;
			if (Object.keys(messageTypes).some(function (mtype) {
				type = mtype;
				return messageTypes[mtype].test(data);
			})) {
				inst.emit(type, data);
			}
		});
	inst.on('r-message', function (data) {
		var msgdata = messageTypes['r-message'].exec(data);
		inst.emit('message', {
			from: msgdata[1],
			message: msgdata[2]
		});
	});
	inst.on('r-auth', function (data) {
		var msgdata = messageTypes['r-auth'].exec(data);
		inst.emit('auth', msgdata[1]);
	});
	inst.on('r-nosuchnick', function (data) {
		var msgdata = messageTypes['r-nosuchnick'].exec(data);
		inst.emit('nosuchnick', msgdata[1]);
	});
	inst.send = message;
	sic = spawnSic();
	return inst;
};
