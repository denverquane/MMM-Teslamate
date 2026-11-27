var mqtt = require('mqtt');
var NodeHelper = require("node_helper");
const topicPrefix = 'teslamate/cars/';

// MQTT servers keyed by "address:port"
var servers = {};

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
        doors: topicPrefix + carID + '/doors_open',
        trunk: topicPrefix + carID + '/trunk_open',
        frunk: topicPrefix + carID + '/frunk_open',
        user: topicPrefix + carID + '/is_user_present',

        outside_temp: topicPrefix + carID + '/outside_temp',
        inside_temp: topicPrefix + carID + '/inside_temp',
        climate_on: topicPrefix + carID + '/is_climate_on',
        preconditioning: topicPrefix + carID + '/is_preconditioning',

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

        update_available: topicPrefix + carID + '/update_available',
        geofence: topicPrefix + carID + '/geofence',
        tpms_pressure_fl: topicPrefix + carID + '/tpms_pressure_fl',
        tpms_pressure_fr: topicPrefix + carID + '/tpms_pressure_fr',
        tpms_pressure_rl: topicPrefix + carID + '/tpms_pressure_rl',
        tpms_pressure_rr: topicPrefix + carID + '/tpms_pressure_rr',
      };
    },

    start: function () {
        console.log(this.name + ': Starting node helper');
        this.loaded = false;
    },

    makeServerKey: function (server) {
        return '' + server.address + ':' + (server.port ?? '1883');
    },

    addServer: function (server, carID) {
        var Topics = this.makeTopics(carID);
        var serverKey = this.makeServerKey(server);
        console.log(this.name + ': Adding car ' + carID + ' on server ' + serverKey);

        // One MQTT client per broker and set of credentials, shared by every
        // module instance (car) that uses them. Previously each instance (and
        // each frontend reload) opened another client without closing the old
        // one, so every message was delivered once per client. The pool key
        // includes the credentials so that an instance never rides on a
        // connection authenticated as someone else; it's only kept in memory.
        var poolKey = JSON.stringify([serverKey, server.user || '', server.password || '']);
        var mqttServer = servers[poolKey];
        if (!mqttServer) {
            mqttServer = {
                serverKey: serverKey,
                address: server.address,
                port: server.port,
                // We resubscribe ourselves on every connect, so that our
                // record of acknowledged topics stays accurate.
                options: { resubscribe: false },
                // Topics wanted by registered instances.
                topics: new Set(),
                // Topics the broker has acknowledged on the current connection.
                subscribed: new Set(),
                // Topics with a SUBSCRIBE in flight on the current connection.
                pending: new Set(),
                // Incremented on each connect, to ignore acks from an old one.
                connection: 0,
                // Last payload per topic, replayed to clients that register
                // after the topics were already subscribed (e.g. a second
                // browser, or a frontend reload).
                values: {},
            };
            if (server.user) mqttServer.options.username = server.user;
            if (server.password) mqttServer.options.password = server.password;
            servers[poolKey] = mqttServer;
            Object.values(Topics).forEach((topic) => mqttServer.topics.add(topic));
            this.startClient(mqttServer);
        } else {
            Object.values(Topics).forEach((topic) => mqttServer.topics.add(topic));
            // Also retries topics whose subscription failed earlier.
            this.subscribeTopics(mqttServer);
        }

        // The broker only sends retained values on subscribe, so a client
        // that registers for already-subscribed topics would otherwise see
        // nothing until each value changes. Replay what we have.
        Object.values(Topics).forEach((topic) => {
            var cached = mqttServer.values[topic];
            if (cached) {
                this.sendSocketNotification('MQTT_PAYLOAD', cached);
            }
        });
    },

    // Subscribe to every wanted topic that isn't acknowledged or in flight.
    // A topic counts as subscribed only once the broker grants it, so a
    // failed subscription is retried the next time an instance registers
    // (e.g. on frontend reload) or the client reconnects.
    subscribeTopics: function (server) {
        if (!server.client || !server.client.connected) {
            return; // the 'connect' handler subscribes everything
        }
        var topics = [...server.topics].filter((topic) => !server.subscribed.has(topic) && !server.pending.has(topic));
        if (topics.length === 0) {
            return;
        }
        var self = this;
        var connection = server.connection;
        topics.forEach((topic) => server.pending.add(topic));
        console.log(self.name + ': ' + server.serverKey + ' subscribing to ' + topics);
        server.client.subscribe(topics, function (err, granted) {
            if (connection !== server.connection) {
                return; // reconnected since; that connection resubscribes
            }
            topics.forEach((topic) => server.pending.delete(topic));
            if (err) {
                console.log(self.name + ': ' + server.serverKey + ' subscribe failed: ', err.message || err);
                return;
            }
            (granted || []).forEach(function (grant) {
                // qos 128 (0x80) or higher is a failure return/reason code.
                if (grant.qos >= 128) {
                    console.log(self.name + ': ' + server.serverKey + ' subscription refused for ' + grant.topic + ' (code ' + grant.qos + ')');
                } else {
                    server.subscribed.add(grant.topic);
                }
            });
        });
    },

    addConfig: function (config) {
        console.log('Adding config');
        this.addServer(config.mqttServer, config.carID);
    },

    startClient: function (server) {

        console.log(this.name + ': Starting client for: ' + server.serverKey);

        var self = this;

        var mqttServer = (server.address.match(/^mqtts?:\/\//) ? '' : 'mqtt://') + server.address;
        if (server.port) {
            mqttServer = mqttServer + ':' + server.port
        }
        console.log(self.name + ': Connecting to ' + mqttServer);

        server.client = mqtt.connect(mqttServer, server.options);

        server.client.on('error', function (err) {
            console.log(self.name + ' ' + server.serverKey + ': Error: ', err);
        });

        server.client.on('reconnect', function (err) {
            server.value = 'reconnecting'; // Hmmm...
            console.log(self.name + ': ' + server.serverKey + ' reconnecting, error was: ', err);
        });

        server.client.on('connect', function (connack) {
            console.log(self.name + ' connected to ' + mqttServer);
            // A new connection starts with no subscriptions of ours.
            server.connection++;
            server.subscribed.clear();
            server.pending.clear();
            self.subscribeTopics(server);
        });

        server.client.on('message', function (topic, payload) {
            var message = {
                serverKey: server.serverKey,
                topic: topic,
                value: payload.toString(),
                time: Date.now()
            };
            server.values[topic] = message;
            self.sendSocketNotification('MQTT_PAYLOAD', message);
        });

    },

    socketNotificationReceived: function (notification, payload) {
        // Don't log the payload: MQTT_CONFIG carries the broker credentials.
        console.log(this.name + ': Socket notification received: ' + notification);
        var self = this;
        if (notification === 'MQTT_CONFIG') {
            var config = payload;
            self.addConfig(config);
            self.loaded = true;
        }
    },
});

