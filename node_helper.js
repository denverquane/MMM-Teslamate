var mqtt = require('mqtt');
var NodeHelper = require("node_helper");

var servers = [];

// TODO export these for use in the teslamate.js?
// TODO hook into config for the car ID
var allTopics = [
    'teslamate/cars/1/display_name',
    'teslamate/cars/1/state',
    'teslamate/cars/1/battery_level',
    'teslamate/cars/1/ideal_battery_range_km',
    'teslamate/cars/1/est_battery_range_km',
    'teslamate/cars/1/plugged_in',
    'teslamate/cars/1/charge_limit_soc',
    'teslamate/cars/1/scheduled_charging_start_time',
    'teslamate/cars/1/charge_energy_added',
    'teslamate/cars/1/speed',
    'teslamate/cars/1/outside_temp',
    'teslamate/cars/1/inside_temp',
    'teslamate/cars/1/locked',
    'teslamate/cars/1/sentry_mode'
];

module.exports = NodeHelper.create({

    start: function () {
        console.log(this.name + ': Starting node helper');
        this.loaded = false;
    },

    makeServerKey: function (server) {
        return '' + server.address + ':' + (server.port | '1883' + server.user);
    },

    addServer: function (server) {
        console.log(this.name + ': Adding server: ', server);
        var serverKey = this.makeServerKey(server);
        var mqttServer = {}
        var foundServer = false;
        for (i = 0; i < servers.length; i++) {
            if (servers[i].serverKey === serverKey) {
                mqttServer = servers[i];
                foundServer = true;
            }
        }
        if (!foundServer) {
            mqttServer.serverKey = serverKey;
            mqttServer.address = server.address;
            mqttServer.port = server.port;
            mqttServer.options = {};
            mqttServer.topics = [];
            if (server.user) mqttServer.options.username = server.user;
            if (server.password) mqttServer.options.password = server.password;
        }

        for (i = 0; i < allTopics.length; i++) {
            console.log(allTopics[i]);
            mqttServer.topics.push(allTopics[i]);
        }

        servers.push(mqttServer);
        this.startClient(mqttServer);
    },

    addConfig: function (config) {
        console.log('Adding config');
        for (i = 0; i < config.mqttServers.length; i++) {
            this.addServer(config.mqttServers[i]);
        }
    },

    startClient: function (server) {

        console.log(this.name + ': Starting client for: ', server);

        var self = this;

        var mqttServer = (server.address.match(/^mqtts?:\/\//) ? '' : 'mqtt://') + server.address;
        if (server.port) {
            mqttServer = mqttServer + ':' + server.port
        }
        console.log(self.name + ': Connecting to ' + mqttServer);

        server.client = mqtt.connect(mqttServer, server.options);

        server.client.on('error', function (err) {
            console.log(self.name + ' ' + server.serverKey + ': Error: ' + err);
        });

        server.client.on('reconnect', function (err) {
            server.value = 'reconnecting'; // Hmmm...
            console.log(self.name + ': ' + server.serverKey + ' reconnecting');
        });

        server.client.on('connect', function (connack) {
            console.log(self.name + ' connected to ' + mqttServer);
            console.log(self.name + ': subscribing to ' + server.topics);
            server.client.subscribe(server.topics);
        });

        server.client.on('message', function (topic, payload) {
            self.sendSocketNotification('MQTT_PAYLOAD', {
                serverKey: server.serverKey,
                topic: topic,
                value: payload.toString(),
                time: Date.now()
            });
        });

    },

    socketNotificationReceived: function (notification, payload) {
        console.log(this.name + ': Socket notification received: ', notification, ': ', payload);
        var self = this;
        if (notification === 'MQTT_CONFIG') {
            var config = payload;
            self.addConfig(config);
            self.loaded = true;
        }
    },
});

