var mqtt = require('mqtt');
var NodeHelper = require("node_helper");
const Topics = {
    name: 'teslamate/cars/1/display_name',
    state: 'teslamate/cars/1/state',
    health: 'teslamate/cars/1/healthy',
  
    lat: 'teslamate/cars/1/latitude',
    lon: 'teslamate/cars/1/longitude',
    shift_state: 'teslamate/cars/1/shift_state',
    speed: 'teslamate/cars/1/speed',
  
    locked: 'teslamate/cars/1/locked',
    sentry: 'teslamate/cars/1/sentry_mode',
    windows: 'teslamate/cars/1/windows_open',
    
    outside_temp: 'teslamate/cars/1/outside_temp',
    inside_temp: 'teslamate/cars/1/inside_temp',
    climate_on: 'teslamate/cars/1/is_climate_on',
  
    odometer: 'teslamate/cars/1/odometer',
    ideal_range: 'teslamate/cars/1/ideal_battery_range_km',
    est_range: 'teslamate/cars/1/est_battery_range_km',
    rated_range: 'teslamate/cars/1/rated_battery_range_km',
  
    battery: 'teslamate/cars/1/battery_level',
    battery_usable: 'teslamate/cars/1/usable_battery_level',
    plugged_in: 'teslamate/cars/1/plugged_in',
    charge_added: 'teslamate/cars/1/charge_energy_added',
    charge_limit: 'teslamate/cars/1/charge_limit_soc',
    // charge_port: 'teslamate/cars/1/charge_port_door_open',
    // charge_current: 'teslamate/cars/1/charger_actual_current',
    // charge_phases: 'teslamate/cars/1/charger_phases',
    // charge_power: 'teslamate/cars/1/charger_power',
    // charge_voltage: 'teslamate/cars/1/charger_voltage',
    charge_start: 'teslamate/cars/1/scheduled_charging_start_time',
    charge_time: 'teslamate/cars/1/time_to_full_charge',
};

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

        for (var key in Topics) {
            console.log(Topics[key]);
            mqttServer.topics.push(Topics[key]);
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

