var sockets = require('json-sockets');
var common = require('common');

var noop = function() {};

var normalize = function(host) {
	var result = (host.match(/([^:\/]*)(?::(\d+))?(?:\/(.*))?/) || []).slice(1);
	
	return {
		host: result[0] || 'localhost',
		port: parseInt(result[1] || module.browser ? 80 : 10547, 10),
		sub: result[2] || '/'
	}
};

exports.connect = function(host) {
	host = normalize(host || '');
	var socket = sockets.connect(host.host + ':' + host.port);

	var pubsub = {};
	var subscriptions = {};	
	
	socket.send({sub:host.sub});
	
	socket.on('message', function(message) {
		if (message.name === 'publish') {
			(subscriptions[message.id] || noop)(message.doc);
		}
	});

	pubsub.subscribe = function(query, selection, callback) {
		if (!callback) {
			callback = selection;
			selection = undefined;
		}

		var id = common.gensym();

		subscriptions[id] = callback;

		socket.send({name:'subscribe', id:id, query:query, selection:selection});
		
		return function() {
			socket.send({name:'unsubscribe', id:id});
		};
	};
	pubsub.publish = function(doc) {
		socket.send({name:'publish', doc:doc});
	};
	pubsub.auth = function(type,val) {
		if (typeof type === 'object') {
			var result = {};
			
			for (var i in type) {
				result[i] = pubsub.auth(type[i],i);
			}
			
			return result;
		}
		if (!val) {
			val = type;
			type = 1;
		}
		
		return {$authenticated:type, value:val};
	};
	
	return pubsub;
};

if (!module.browser) {
	var signer = require("signer");

	exports.signer = function(secret) {	
		return function(doc) {
			var signed = {};
		
			for (var i in doc) {
				signed[i] = {$signed:signer.sign(i.replace(/\//g, '-')+'/'+doc[i]), value:doc[i]};
			}
			return signed;
		};
	};
}