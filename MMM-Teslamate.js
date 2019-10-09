//TODO I could not get these to be global and shared between this file and node_helper...
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

  odometer: 'teslamate/cars/1/odometer',
  ideal_range: 'teslamate/cars/1/ideal_battery_range_km',
  est_range: 'teslamate/cars/1/est_battery_range_km',
  rated_range: 'teslamate/cars/1/rated_battery_range_km',

  battery: 'teslamate/cars/1/battery_level',
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
    this.subscriptions = {
      lat: {},
      lon: {},
    };

    console.log(this.name + ': Setting up connection to server');

    var s = this.config.mqttServer
    var serverKey = this.makeServerKey(s);
    console.log(this.name + ': Adding config for ' + s.address + ' port ' + s.port + ' user ' + s.user);

    for (let key in Topics) {
      var topic = Topics[key];
      console.log(topic);
      this.subscriptions[key] = {
        topic: topic,
        serverKey: serverKey,
        value: null,
        time: null
      };
    }

    this.openMqttConnection();
    var self = this;
    setInterval(function () {
      self.updateDom(100);
    }, 300000); //every 5 minutes

  },

  openMqttConnection: function () {
    this.sendSocketNotification('MQTT_CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_PAYLOAD') {
      if (payload != null) {
        var updatedImportant = false;
	for (let key in this.subscriptions) {
          sub = this.subscriptions[key];
          console.log(sub);
          if (sub.serverKey == payload.serverKey && sub.topic == payload.topic) {
            var value = payload.value;
            sub.value = value;
            sub.time = payload.time;

	    if ((key === "lat" || key === "lon") && sub.value.toFixed(4) !== this.subscriptions.value.toFixed(4)) {
		console.log("Updated important");
		updatedImportant = true;
	    }
            this.subscriptions[key] = sub;
          }
        }
	if (updatedImportant) {
	  this.updateDom();
	}
      } else {
        console.log(this.name + ': MQTT_PAYLOAD - No payload');
      }
    }
  },

  getDom: function () {
    const kmToMiFixed = function (miles, fixed) {
      return (miles / 1.609).toFixed(fixed);
    };

    const cToFFixed = function (celcius, fixed) {
      return ((celcius * 9/5) + 32).toFixed(fixed);
    };
    const wrapper = document.createElement('div');

    const carName = this.subscriptions["name"].value;
    //TODO is this interesting to see displayed?
    const state = this.subscriptions["state"].value;
    const latitude = this.subscriptions["lat"].value;
    const longitude = this.subscriptions["lon"].value;
    const battery = this.subscriptions["battery"].value;
    const chargeLimitSOC = this.subscriptions["charge_limit"].value;
    //TODO format this correctly
    const chargeStart = this.subscriptions["charge_start"].value;
    const timeToFull = this.subscriptions["charge_time"].value;
    const pluggedIn = this.subscriptions["plugged_in"].value && timeToFull > 0.0;
    const energyAdded = this.subscriptions["charge_added"].value;
    const locked = this.subscriptions["locked"].value;
    const sentry = this.subscriptions["sentry"].value;

    const gUrl = "https://www.google.com/maps/embed/v1/place?key=" + this.config.gMapsApiKey + "&q=" + latitude + "," + longitude + "&zoom=" + this.config.mapZoomLevel;

    var idealRange = this.subscriptions["ideal_range"].value ? this.subscriptions["ideal_range"].value : 0;
    var estRange = this.subscriptions["est_range"].value ? this.subscriptions["est_range"].value : 0;
    var speed = this.subscriptions["speed"].value ? this.subscriptions["speed"].value : 0;
    var outside_temp = this.subscriptions["outside_temp"].value ? this.subscriptions["outside_temp"].value : 0;
    var inside_temp = this.subscriptions["inside_temp"].value ? this.subscriptions["inside_temp"].value : 0;
    var odometer = this.subscriptions["odometer"].value ? this.subscriptions["odometer"].value : 0;

    if (!this.config.imperial) {
      idealRange = (idealRange * 1.0).toFixed(0);
      estRange = (estRange * 1.0).toFixed(0);
      speed = (speed * 1.0).toFixed(0);
      odometer = (odometer * 1.0).toFixed(0);

      outside_temp = (outside_temp * 1.0).toFixed(1);
      inside_temp = (inside_temp * 1.0).toFixed(1);
    } else {
      idealRange = kmToMiFixed(idealRange, 0);
      estRange = kmToMiFixed(estRange, 0);
      speed = kmToMiFixed(speed, 0);
      odometer = kmToMiFixed(odometer, 0);

      outside_temp = cToFFixed(outside_temp, 1);
      inside_temp = cToFFixed(inside_temp, 1);
    }

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

    const makeSpan = function(className, content) {
      var span = document.createElement("span");
      span.className = className;
      span.innerHTML = content;
      return span;
    }

    var title = document.createElement("h2");
    title.className = "mqtt-title";
    var iconSpan = document.createElement("span");

    //TODO does this need to be "classlist"?
    iconSpan.className = "zmdi zmdi-car zmdi-hc-2x icon"
    title.innerHTML = carName;
    title.prepend(iconSpan);
    if (pluggedIn) {
      var chargeIconSpan = document.createElement("span");
      chargeIconSpan.className = "zmdi zmdi-input-power zmdi-hc-1x charge-icon";
      title.appendChild(chargeIconSpan);
    }

    wrapper.appendChild(title);

    var attrList = document.createElement("ul");
    attrList.className = "mattributes";
    if (this.config.gMapsApiKey !== "") {
      var gmapLi = document.createElement("li");
      gmapLi.className = "mattribute";
      var iframe = document.createElement("iframe");
      iframe.setAttribute("style", "border:0");
      iframe.setAttribute("width", 400);
      iframe.setAttribute("height", 300);
      iframe.setAttribute("src", gUrl);
      gmapLi.appendChild(iframe);
      attrList.appendChild(gmapLi);
    }

    var batteryLi = document.createElement("li");
    batteryLi.className = "mattribute battery-level battery-level-" 
      + getBatteryLevelClass(battery, this.config.batteryWarning, this.config.batteryDanger);
    batteryLi.appendChild(makeSpan("icon zmdi zmdi-battery zmdi-hc-fw", ""));
    batteryLi.appendChild(makeSpan("name", "Current Battery"));
    batteryLi.appendChild(makeSpan("value", battery + "%"));

    var maxBatteryLi = document.createElement("li");
    maxBatteryLi.className = "mattribute battery-level battery-level-" 
      + getBatteryLevelClass(chargeLimitSOC, this.config.batteryWarning, this.config.batteryDanger);
    maxBatteryLi.appendChild(makeSpan("icon zmdi zmdi-battery zmdi-hc-fw", ""));
    maxBatteryLi.appendChild(makeSpan("name", "Max Battery"));
    maxBatteryLi.appendChild(makeSpan("value", chargeLimitSOC + "%"));

    var rangeCompare = document.createElement("li");
    rangeCompare.className = "mattribute";
    rangeCompare.appendChild(makeSpan("icon zmdi zmdi-car zmdi-hc-fw", ""));
//    rangeCompare.appendChild(makeSpan("name", "Ideal v. Est. Range"));
    rangeCompare.appendChild(makeSpan("name", "Ideal Range"));
    rangeCompare.appendChild(makeSpan("value", idealRange + (!this.config.imperial ? " Km" : " Mi")));

    attrList.appendChild(batteryLi)
    attrList.appendChild(maxBatteryLi);
    attrList.appendChild(rangeCompare);

    if (pluggedIn) {
      var energyAddedLi = document.createElement("li");
      energyAddedLi.className = "mattribute";
      energyAddedLi.appendChild(makeSpan("icon zmdi zmdi-input-power zmdi-hc-fw", ""));
      energyAddedLi.appendChild(makeSpan("name", "Charge Added"));
      energyAddedLi.appendChild(makeSpan("value", energyAdded + " kWh"));

      var timeToFullLi =  document.createElement("li");
      timeToFullLi.className = "mattribute";
      timeToFullLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
      timeToFullLi.appendChild(makeSpan("name", "Time to " + chargeLimitSOC + "%"));
      timeToFullLi.appendChild(makeSpan("value", timeToFull + " Hours"));
      attrList.appendChild(energyAddedLi);
      attrList.appendChild(timeToFullLi);
    }

    var odometerLi = document.createElement("li");
    odometerLi.className = "mattribute";
    odometerLi.appendChild(makeSpan("icon zmdi zmdi-dot-circle-alt zmdi-hc-fw", ""));
    odometerLi.appendChild(makeSpan("name", "Odometer"));
    odometerLi.appendChild(makeSpan("value", odometer + (!this.config.imperial ? " Km" : " Mi")));

    attrList.appendChild(odometerLi);
    wrapper.appendChild(attrList);
  //   <li class="mattribute sentry-mode ${
  //     locked ? 'sentry-mode-active' : ''
  //     }">
  //     <span class="icon zmdi zmdi-lock zmdi-hc-fw"></span>
  //     <span class="name">Lock</span>
  //     <span class="value">${ locked ?
  //       '<span class="zmdi zmdi-lock"></span> Locked' :
  //       '<span class="zmdi zmdi-lock-open"></span> Unlocked'}
  //     </span>
  //   </li>
  //   <li class="mattribute sentry-mode ${
  //     sentry ? 'sentry-mode-active' : ''
  //     }">
  //     <span class="icon zmdi zmdi-shield-security zmdi-hc-fw"></span>
  //     <span class="name">Sentry Mode</span>
  //     <span class="value">${ sentry ?
  //       '<span class="zmdi zmdi-play-circle"></span> Enabled' : 'Disabled'}
  //     </span>
  //   </li>
  // </ul>
	// 	`;
    return wrapper;
  }
});
