
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
    mqttServers: []
  },

  makeServerKey: function (server) {
    return '' + server.address + ':' + (server.port | '1883' + server.user);
  },

  start: function () {
    console.log(this.name + ' started.');
    this.subscriptions = [
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

    console.log(this.name + ': Setting up connection to ' + this.config.mqttServers.length + ' servers');

    for (i = 0; i < this.config.mqttServers.length; i++) {
      var s = this.config.mqttServers[i]
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
    // TODO hook into config for imperial v. metric
    const wrapper = document.createElement('div');
    const carName = this.subscriptions[0].value;
    const state = this.subscriptions[1].value;
    const battery = this.subscriptions[2].value;
    const idealRange = (this.subscriptions[3].value / 1.609).toFixed(0);
    const estRange = (this.subscriptions[4].value / 1.609).toFixed(0);
    const pluggedIn = this.subscriptions[5].value;
    const chargeLimitSOC = this.subscriptions[6].value;
    const chargeStartTime = this.subscriptions[7].value
    const energyAdded = this.subscriptions[8].value;
    const speed = (this.subscriptions[9].value / 1.609).toFixed(1);
    const outside_temp = (this.subscriptions[10].value * 9 / 5 + 32).toFixed(1);
    const inside_temp = (this.subscriptions[11].value * 9 / 5 + 32).toFixed(1);
    const locked = this.subscriptions[12].value;
    const sentry = this.subscriptions[13].value;

    const getBatteryLevelClass = function (bl) {
      if (bl < 30) {
        return 'danger';
      }
      if (bl < 50) {
        return 'warning';
      }
      if (bl >= 50) {
        return 'ok';
      }

      return '';
    };

    wrapper.innerHTML = `
      <h2 class="mqtt-title"><span class="zmdi zmdi-car zmdi-hc-2x icon"></span> ${carName}</h2>
      <ul class="mattributes">
        <li class="mattribute battery-level battery-level-${getBatteryLevelClass(
      battery,
    )}">
          <span class="icon zmdi zmdi-battery zmdi-hc-fw"></span>
          <span class="name">Current Battery / Max</span>
          <span class="value">${battery} / ${chargeLimitSOC}%</span>
        </li>
        <li class="mattribute">
          <span class="icon zmdi zmdi-car zmdi-hc-fw"></span>
          <span class="name">Ideal/Estimated Ranges</span>
          <span class="value">${idealRange}/${estRange} Mi</span>
        </li>
        ${pluggedIn ? `
        <li class="mattribute">
        <span class="icon zmdi zmdi-input-power zmdi-hc-fw"></span>
        <span class="name">Charge Added</span>
        <span class="value">${energyAdded} kW</span>
      </li>`: ``}
        ${speed > 0.0 ? `
        <li class="mattribute">
      <span class="icon zmdi zmdi-traffic zmdi-hc-fw"></span>
      <span class="name">Speed</span>
      <span class="value">${speed} Mph</span>
    </li>
    ` : ``}

        <li class="mattribute">
          <span class="icon zmdi zmdi-cloud-outline-alt zmdi-hc-fw"></span>
          <span class="name">Inside</span>
          <span class="value">${inside_temp}&deg;F</span>
        </li>
        <li class="mattribute">
          <span class="icon zmdi zmdi-cloud-outline zmdi-hc-fw"></span>
          <span class="name">Outside</span>
          <span class="value">${outside_temp}&deg;F</span>
        </li>
	<li class="mattribute sentry-mode ${
      locked ? 'sentry-mode-active' : ''
      }">
          <span class="icon zmdi zmdi-lock zmdi-hc-fw"></span>
          <span class="name">Lock</span>
          <span class="value">${
      locked
        ? '<span class="zmdi zmdi-lock"></span> Locked'
        : '<span class="zmdi zmdi-lock-open"></span> Unlocked'
      }</span>
        </li>
        <li class="mattribute sentry-mode ${
      sentry ? 'sentry-mode-active' : ''
      }">
          <span class="icon zmdi zmdi-shield-security zmdi-hc-fw"></span>
          <span class="name">Sentry Mode</span>
          <span class="value">${
      sentry
        ? '<span class="zmdi zmdi-play-circle"></span> On'
        : 'Off'
      }</span>
        </li>
		  </ul>
		`;
    return wrapper;
  }
});
