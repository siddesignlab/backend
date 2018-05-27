var express = require('express');
var router = express.Router();
var User = require('../auth/models/User');
var run = require('./compiler');
var pseudoSocket = require('./pseudoSocket');

function rough(str) {
	return str.trim().toLowerCase().replace(/[^a-z0-9\r\n.]/g, '');
}

function regEscape(str) {
	return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

var answers = {
	1: [
		{
			stdin: '',
			stdout: 'Hello World\n'
		}
	],
	2: [
		{
			stdin: '',
			stdout: '155 Main St, Delhi 84101, INDIA\n'
		}
	],
	3: [
		{
			stdin: '',
			stdout: 'Float\nInteger\nString\nFloat\nString\n'
		}
	],
	4: [
		{
			stdin: 'Kevin',
			stdout: 'What\'s your name?\nWelcome to the bakery,\nKevin\n'
		},
		{
			stdin: 'Jake Peralta',
			stdout: 'What\'s your name?\nWelcome to the bakery,\nJake Peralta\n'
		}
	],
	5: [
		{
			stdin: '',
			stdout: '112.5\n'
		}
	],
	6: [
		{
			stdin: 'Japnit',
			stdout: 'What\'s your name?\nWelcome to the bakery Japnit! What would you like to order today?\n'
		},
		{
			stdin: 'Dhimant',
			stdout: 'What\'s your name?\nWelcome to the bakery Dhimant! What would you like to order today?\n'
		}
	],
	7: [
		{
			stdin: '',
			stdout: 'True\nFalse\nTrue\n'
		}
	],
	8: [
		{
			stdin: '42',
			stdout: 'Enter a number:\nHere is a free toffee! Have a nice day!\n'
		},
		{
			stdin: '43',
			stdout: 'Enter a number:\nHave a nice day!\n'
		}
	],
	9: [
		{
			stdin: '11',
			stdout: 'Enter the time:\nEve is free at 11\n'
		},
		{
			stdin: '23',
			stdout: 'Enter the time:\nEve is free at 23\n'
		},
		{
			stdin: '14',
			stdout: 'Enter the time:\nEve is not free at 14\n'
		}
	],
	10: [
		{
			stdin: '',
			stdout: 'Flour\n'
		}
	],
	11: [
		{
			stdin: '',
			stdout: '96\n'
		}
	],
	12: [
		{
			stdin: '',
			stdout: 'Dark Chocolate\nVanilla Cupcakes\n'
		}
	],
	13: [
		{
			stdin: '',
			stdout: 'not prime\n'
		}
	],
};

function checkCorrect(level, answer, callback) {
	var returnValues = [];

	if(!answers[level] || answers[level].length == 0) {
		callback(false);
		return;
	}

	for(var i = 0; i < answers[level].length; i++) {
		(function(i) {
			var stdin = answers[level][i].stdin;
			var stdout = answers[level][i].stdout;

			var socket = new pseudoSocket(stdin);

			var program = run(answer, socket);

			program.stdout.on('data', function(data) {
				socket.emit('stdout', data);
			});

			program.stderr.on('data', function(data) {
				socket.emit('stderr', data);
			});

			socket.on('stdin', function(data) {
				program.stdin.write(data + '\n');
			});

			program.on('exit', function() {
				//                                   vvvvvvvvvvvvvvvvvvvvvvv for Windows hosts
				var received = socket.output().stdout.replace(/\r\n/g, '\n');
				returnValues[returnValues.length] = (received === stdout);
				if(returnValues.length === answers[level].length) {
					var checker = returnValues.indexOf(false) < 0;
					callback(checker);
				}
			});
		})(i);
	}
}

router.get('/:level', function(req, res) {
	if(req.isAuthenticated()) {

		if(answers[req.params.level]) {
			var nextLevel = parseInt(req.params.level) + 1;
			res.render('level', {
				user: req.user.username,
				nextLevel: nextLevel,
				partials: {
					levelText: 'levels/' + req.params.level
				}
			});
		}
		else {
			res.redirect('/dashboard');
		}
	} else {
		res.redirect('/login');
	}
});

router.post('/:level', function(req, res, next) {
	try {
		if(req.isAuthenticated()) {
			checkCorrect(req.params.level, req.body.answer, function(isCorrect) {
				if(isCorrect) {
					var win = function() { res.send({ message: 'win' }) };

					var dealWith = function(err) {
						console.log(err);
						res.send(err);
					}

					User.findById(req.user._id, function(err, user) {
						if(err) {
							console.log(err);
							res.send(err);
						}
						else {
							var solvedLevels = user.solvedLevels || {};

							// check if user has already solved this level before
							if(!solvedLevels[req.params.level]) {
								solvedLevels[req.params.level] = true;
								var score = 0;

								// calculate score based on previously solved levels
								for(var level in solvedLevels) {
									if(solvedLevels[level] == true) score += (100/(Object.keys(answers).length));
								}

								User.findByIdAndUpdate(req.user._id, { points: score, solvedLevels: solvedLevels }, function(err, user) {
									if(err) {
										console.log(err);
										res.send(err);
									}
									else    win();
								});
							}
							else win();
						}
					});
				}
				else {
					res.send({ message: 'lose' });
				}
			});
		} else {
			res.send({ message: 'logout' });
		}
	} catch(e) {
		console.log(e);
		res.send({ message: 'error' });
	}
});

module.exports = router;
