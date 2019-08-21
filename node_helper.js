var mqtt = require('mqtt');
var NodeHelper = require("node_helper");
const Topics = [
  { topic: 'teslamate/cars/1/display_name' },
  { topic: 'teslamate/cars/1/state' },
  { topic: 'teslamate/cars/1/battery_level' },
  { topic: 'teslamate/cars/1/ideal_battery_range_km' },
  { topic: 'teslamate/cars/1/est_battery_range_km' },
  { topic: 'teslamate/cars/1/plugged_in' },
  { topic: 'teslamate/cars/1/charge_limit_soc' },
  { topic: 'teslamate/cars/1/scheduled_charging_start_time' },
  { topic: 'teslamate/cars/1/charge_energy_added' },
  { topic: 'teslamate/cars/1/speed' },
  { topic: 'teslamate/cars/1/outside_temp' },
  { topic: 'teslamate/cars/1/inside_temp' },
  { topic: 'teslamate/cars/1/locked' },
  { topic: 'teslamate/cars/1/sentry_mode' },
];

var globalServer = {};

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
        if (globalServer.serverKey === serverKey) {
            mqttServer = globalServer;
        } else {
            mqttServer.serverKey = serverKey;
            mqttServer.address = server.address;
            mqttServer.port = server.port;
            mqttServer.options = {};
            mqttServer.topics = [];
            if (server.user) mqttServer.options.username = server.user;
            if (server.password) mqttServer.options.password = server.password;
        }

        for (i = 0; i < Topics.length; i++) {
            console.log(Topics[i]);
            mqttServer.topics.push(Topics[i].topic);
        }

        globalServer = mqttServer;
        this.startClient(mqttServer);
    },

    addConfig: function (config) {
        console.log('Adding config');
        this.addServer(config.mqttServer);
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

