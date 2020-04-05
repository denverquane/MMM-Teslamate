var mqtt = require('mqtt');
var NodeHelper = require("node_helper");
const topicPrefix = 'teslamate/cars/';

var globalServer = {};

module.exports = NodeHelper.create({

    makeTopics: function (carID) {
      return {
    name: topicPrefix + carID + '/display_name',
    state: topicPrefix + carID + '/state',
    health: topicPrefix + carID + '/healthy',

    lat: topicPrefix + carID + '/latitude',
    lon: topicPrefix + carID + '/longitude',
    shift_state: topicPrefix + carID + '/shift_state',
    speed: topicPrefix + carID + '/speed',

    locked: topicPrefix + carID + '/locked',
    sentry: topicPrefix + carID + '/sentry_mode',
    windows: topicPrefix + carID + '/windows_open',

    outside_temp: topicPrefix + carID + '/outside_temp',
    inside_temp: topicPrefix + carID + '/inside_temp',
    climate_on: topicPrefix + carID + '/is_climate_on',

    odometer: topicPrefix + carID + '/odometer',
    ideal_range: topicPrefix + carID + '/ideal_battery_range_km',
    est_range: topicPrefix + carID + '/est_battery_range_km',
    rated_range: topicPrefix + carID + '/rated_battery_range_km',

    battery: topicPrefix + carID + '/battery_level',
    battery_usable: topicPrefix + carID + '/usable_battery_level',
    plugged_in: topicPrefix + carID + '/plugged_in',
    charge_added: topicPrefix + carID + '/charge_energy_added',
    charge_limit: topicPrefix + carID + '/charge_limit_soc',
    // charge_port: 'teslamate/cars/1/charge_port_door_open',
    // charge_current: 'teslamate/cars/1/charger_actual_current',
    // charge_phases: 'teslamate/cars/1/charger_phases',
    // charge_power: 'teslamate/cars/1/charger_power',
    // charge_voltage: 'teslamate/cars/1/charger_voltage',
    charge_start: topicPrefix + carID + '/scheduled_charging_start_time',
    charge_time:  topicPrefix + carID + '/time_to_full_charge',
      };
    },

    start: function () {
        console.log(this.name + ': Starting node helper');
        this.loaded = false;
    },

    makeServerKey: function (server) {
        return '' + server.address + ':' + (server.port | '1883' + server.user);
    },

    addServer: function (server, carID) {
        var Topics = this.makeTopics(carID);
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

        for (var key in Topics) {
            console.log(Topics[key]);
            mqttServer.topics.push(Topics[key]);
        }

        globalServer = mqttServer;
        this.startClient(mqttServer);
    },

    addConfig: function (config) {
        console.log('Adding config');
        this.addServer(config.mqttServer, config.carID);
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

