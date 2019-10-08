//TODO I could not get these to be global and shared between this file and node_helper...
const Topics = [
  { topic: 'teslamate/cars/1/display_name' },
  { topic: 'teslamate/cars/1/state' },
  { topic: 'teslamate/cars/1/healthy' },

  { topic: 'teslamate/cars/1/latitude' },
  { topic: 'teslamate/cars/1/longitude' },
  { topic: 'teslamate/cars/1/shift_state' },
  { topic: 'teslamate/cars/1/speed' },

  { topic: 'teslamate/cars/1/locked' },
  { topic: 'teslamate/cars/1/sentry_mode' },
  { topic: 'teslamate/cars/1/windows_open' },

  { topic: 'teslamate/cars/1/outside_temp' },
  { topic: 'teslamate/cars/1/inside_temp' },

  { topic: 'teslamate/cars/1/odometer' },
  { topic: 'teslamate/cars/1/ideal_battery_range_km' },
  { topic: 'teslamate/cars/1/est_battery_range_km' },
  { topic: 'teslamate/cars/1/rated_battery_range_km' },

  { topic: 'teslamate/cars/1/battery_level' },
  { topic: 'teslamate/cars/1/plugged_in' },
  { topic: 'teslamate/cars/1/charge_energy_added' },
  { topic: 'teslamate/cars/1/charge_limit_soc' },
  { topic: 'teslamate/cars/1/charge_port_door_open' },
  { topic: 'teslamate/cars/1/charger_actual_current' },
  { topic: 'teslamate/cars/1/charger_phases' },
  { topic: 'teslamate/cars/1/charger_power' },
  { topic: 'teslamate/cars/1/charger_voltage' },
  { topic: 'teslamate/cars/1/scheduled_charging_start_time' },
  { topic: 'teslamate/cars/1/time_to_full_charge' },
];

Module.register("MMM-Teslamate", {

  getScripts: function () {
    return [
      'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.min.js',
    ];
  },
  getStyles: function () {
    return [
      'https://cdnjs.cloudflare.com/ajax/libs/material-design-iconic-font/2.2.0/css/material-design-iconic-font.min.css',
      'Teslamate.css',
    ];
  },

  // Default module config
  defaults: {
    mqttServer: {},
    imperial: false,
    batteryDanger: 30,
    batteryWarning: 50,
    gMapsApiKey: "",
    mapZoomLevel: 10,
  },

  makeServerKey: function (server) {
    return '' + server.address + ':' + (server.port | '1883' + server.user);
  },

  start: function () {
    console.log(this.name + ' started.');
    this.subscriptions = Topics;

    console.log(this.name + ': Setting up connection to server');

    var s = this.config.mqttServer
    var serverKey = this.makeServerKey(s);
    console.log(this.name + ': Adding config for ' + s.address + ' port ' + s.port + ' user ' + s.user);
    for (j = 0; j < this.subscriptions.length; j++) {
      var sub = this.subscriptions[j];
      console.log(sub);
      this.subscriptions[j] = {
        topic: sub.topic,
        serverKey: serverKey,
        value: null,
        time: null
      };
    }

    this.openMqttConnection();
    var self = this;
    setInterval(function () {
      self.updateDom(100);
    }, 5000);
  },

  openMqttConnection: function () {
    this.sendSocketNotification('MQTT_CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_PAYLOAD') {
      if (payload != null) {
        for (i = 0; i < this.subscriptions.length; i++) {
          sub = this.subscriptions[i];
          console.log(sub);
          if (sub.serverKey == payload.serverKey && sub.topic == payload.topic) {
            var value = payload.value;
            sub.value = value;
            sub.time = payload.time;
            this.subscriptions[i] = sub;
          }
        }
        this.updateDom();
      } else {
        console.log(this.name + ': MQTT_PAYLOAD - No payload');
      }
    }
  },

  getDom: function () {
    const wrapper = document.createElement('div');

    //TODO These values are brittle, probably need a better way to check besides just using the explicit indices...
    const carName = this.subscriptions[0].value;
    //TODO is this interesting to see displayed?
    const state = this.subscriptions[1].value;
    const latitude = this.subscriptions[3].value;
    const longitude = this.subscriptions[4].value;
    const battery = this.subscriptions[16].value;
    const idealRange = this.subscriptions[13].value ? (!this.config.imperial ?
	(this.subscriptions[13].value * 1.0).toFixed(0) :
  (this.subscriptions[13].value / 1.609).toFixed(0)) : 0;

    const estRange = this.subscriptions[14].value ? (!this.config.imperial ?
	(this.subscriptions[14].value * 1.0).toFixed(0) :
  (this.subscriptions[14].value / 1.609).toFixed(0)) : 0;

    const pluggedIn = this.subscriptions[17].value;
    const chargeLimitSOC = this.subscriptions[19].value;

    //TODO format this correctly
    const chargeStartTime = this.subscriptions[25].value;
    const timeToFull = this.subscriptions[26].value;
    const energyAdded = this.subscriptions[18].value;
    const speed = this.subscriptions[6].value ? (!this.config.imperial ?
	(this.subscriptions[6].value * 1.0).toFixed(1) :
	(this.subscriptions[6].value / 1.609).toFixed(1)) : 0;
    const outside_temp = this.subscriptions[10].value ? (!this.config.imperial ? 
	(this.subscriptions[10].value * 1.0).toFixed(1) :
	(this.subscriptions[10].value * 9 / 5 + 32).toFixed(1)) : 0;
    const inside_temp = this.subscriptions[11].value ? (!this.config.imperial ?
	(this.subscriptions[11].value * 1.0).toFixed(1) :
  (this.subscriptions[11].value * 9 / 5 + 32).toFixed(1)) : 0;

    const odometer = this.subscriptions[12].value ? (!this.config.imperial ?
      (this.subscriptions[12].value * 1.0).toFixed(1) :
      (this.subscriptions[12].value / 1.609).toFixed(0)) : 0;
    const locked = this.subscriptions[7].value;
    const sentry = this.subscriptions[8].value;

    const getBatteryLevelClass = function (bl, warn, danger) {
      if (bl < danger) {
        return 'danger';
      }
      if (bl < warn) {
        return 'warning';
      }
      if (bl >= warn) {
        return 'ok';
      }

      return '';
    };
    const gUrl = "https://www.google.com/maps/embed/v1/place?key=" + this.config.gMapsApiKey + "&q=" + latitude + "," + longitude + "&zoom=" + this.config.mapZoomLevel;
    wrapper.innerHTML = `
    <h2 class="mqtt-title">
    <span class="zmdi zmdi-car zmdi-hc-2x icon"></span> ${carName}</h2>
  <ul class="mattributes">
    <li class="mattribute battery-level battery-level-${getBatteryLevelClass(
        battery, this.config.batteryWarning, this.config.batteryDanger
      )}">
      <span class="icon zmdi zmdi-battery zmdi-hc-fw"></span>
      <span class="name">Current Battery Level</span>
      <span class="value">${battery}%</span>
    </li>
    <li class="mattribute battery-level battery-level-${getBatteryLevelClass(
      chargeLimitSOC, this.config.batteryWarning, this.config.batteryDanger
    )}">
    <span class="icon zmdi zmdi-battery zmdi-hc-fw"></span>
    <span class="name">Max Battery Level</span>
    <span class="value">${chargeLimitSOC}%</span>
  </li>
    <li class="mattribute">
      <span class="icon zmdi zmdi-car zmdi-hc-fw"></span>
      <span class="name">Ideal v. Est. Range</span>
      <span class="value">${idealRange} v. ${estRange} ${!this.config.imperial ? `Km` : `Mi`}</span>
    </li>
    ${pluggedIn ? `
    <li class="mattribute">
      <span class="icon zmdi zmdi-input-power zmdi-hc-fw"></span>
      <span class="name">Charge Added</span>
      <span class="value">${energyAdded} kWh</span>
    </li>
    <li class="mattribute">
      <span class="icon zmdi zmdi-time zmdi-hc-fw"></span>
      <span class="name">Time to Full Charge</span>
      <span class="value">${timeToFull} Hours</span>
    </li>
    `: ``} 
    <li class="mattribute sentry-mode ${
      locked ? 'sentry-mode-active' : ''
      }">
      <span class="icon zmdi zmdi-lock zmdi-hc-fw"></span>
      <span class="name">Lock</span>
      <span class="value">${ locked ?
        '<span class="zmdi zmdi-lock"></span> Locked' :
        '<span class="zmdi zmdi-lock-open"></span> Unlocked'}
      </span>
    </li>
    <li class="mattribute sentry-mode ${
      sentry ? 'sentry-mode-active' : ''
      }">
      <span class="icon zmdi zmdi-shield-security zmdi-hc-fw"></span>
      <span class="name">Sentry Mode</span>
      <span class="value">${ sentry ?
        '<span class="zmdi zmdi-play-circle"></span> Enabled' : 'Disabled'}
      </span>
    </li>
    <li class="mattribute">
      <span class="icon zmdi zmdi-dot-circle-alt zmdi-hc-fw"></span>
      <span class="name">Odometer</span>
      <span class="value">${odometer} ${!this.config.imperial ? `Km` : `Mi`}</s$
    </li>
    ${this.config.gMapsApiKey !== "" ? `<li class="mattribute">
	<iframe style="border:0" width=400 height=300 src=${gUrl}></iframe>
    </li>` : ``}
  </ul>
		`;
    return wrapper;
  }
});
