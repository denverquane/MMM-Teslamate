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
//    setInterval(function () {
//      self.updateDom(100);
//    }, 300000); //every 5 minutes

  },

  openMqttConnection: function () {
    this.sendSocketNotification('MQTT_CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_PAYLOAD') {
      if (payload != null) {
        //var updatedImportant = false;
	for (let key in this.subscriptions) {
          sub = this.subscriptions[key];
          //console.log(sub);
          if (sub.serverKey == payload.serverKey && sub.topic == payload.topic) {
            var value = payload.value;
            sub.value = value;
            sub.time = payload.time;

//	    if ((key === "lat" || key === "lon") && sub.value.toFixed(4) !== this.subscriptions.value.toFixed(4)) {
//		console.log("Updated important");
//		updatedImportant = true;
//	    }
            this.subscriptions[key] = sub;
          }
        }
//	if (updatedImportant) {
	  this.updateDom();
//	}
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
    const windowsOpen = this.subscriptions["windows"].value;

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

    const data = {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry, gUrl,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen
    }

    if (this.config.graphicView)
      this.generateGraphicDom(wrapper, data);
    else
      this.generateTableDom(wrapper, data);

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
  },

  generateTableDom: function(wrapper, data) {
    const { 
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry, gUrl,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen
    } = data;

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
    //if (!pluggedIn) {
    //  var chargeIconSpan = document.createElement("span");
    //  chargeIconSpan.className = "zmdi zmdi-input-power zmdi-hc-1x charge-icon";
    //  title.appendChild(chargeIconSpan);
    //}

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
  },

  generateGraphicDom: function(wrapper, data) {
    const { 
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry, gUrl,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen
    } = data;

    const stateIcons = []
    if (state == "online")
      stateIcons.push({ icon: "signal", opacity: 0.75 });
    if (state == "offline")
      stateIcons.push({ icon: "signal-off", opacity: 0.75 });
    if (state == "asleep" || state == "suspended")
      stateIcons.push({ icon: "sleep", opacity: 0.75 });
    if (state == "suspended")
      stateIcons.push({ icon: "timer-sand" });
    if (pluggedIn == "true")
      stateIcons.push({ icon: "ev-station" });
    if (locked == "false")
      stateIcons.push({ icon: "lock-open-variant" });
    if (sentry == "true")
      stateIcons.push({ icon: "cctv" });
    if (state == "updating")
      stateIcons.push({ icon: "cog-clockwise" });
    if (windowsOpen == "true")
      stateIcons.push({ icon: "window-open" });

    const teslaModel = this.config.carImageOptions.model || "m3";
    const teslaView = this.config.carImageOptions.view || "STUD_3QTR";
    const teslaOptions = this.config.carImageOptions.options || "PPSW,W32B,SLR1";

    const teslaImageUrl = `https://static-assets.tesla.com/v1/compositor/?model=${teslaModel}&view=${teslaView}&size=450&options=${teslaOptions}&bkba_opt=1`;
    const imageOffset = this.config.carImageOptions.verticalOffset || 0;
    const imageOpacity = this.config.carImageOptions.imageOpacity || 0.4;

    const renderedStateIcons = stateIcons.map((icon) => 
      `<span class="mdi mdi-${icon.icon}" ${icon.opacity ? "style='opacity: " + icon.opacity + "'" : ""}></span>`)

    wrapper.innerHTML = `
      <div style="width: 450px; height: 253px;">
        <link href="https://cdn.materialdesignicons.com/4.8.95/css/materialdesignicons.min.css" rel="stylesheet" type="text/css"> 
        <div style="z-index: 1; position: absolute; top: 0px; left: 0px; 
                    width: 450px; height: 253px; 
                    opacity: ${imageOpacity}; 
                    background-image: url('${teslaImageUrl}'); 
                    background-position: 0px ${imageOffset}px;
                    ">
        </div>
        <div style="z-index: 2; position: absolute; top: 0px; left: 0px;">

          <!-- Percentage/range -->
          <div style="margin-top: 50px; margin-left: auto; text-align: center; width: 450px; height: 70px">
            <span class="bright large light">${battery}</span><span class="normal medium">%</span>
          </div>

          <!-- Battery graphic - outer border -->
          <div style="margin-left: 100px; 
                      width: 250px; height: 75px;
                      border: 2px solid #aaa;
                      border-radius: 10px">

            <!-- Plus pole -->
            <div style="position: relative; top: 27px; left: 250px;
                        width: 8px; height: 19px;
                        border: 2px solid #aaa;
                        border-top-right-radius: 5px;
                        border-bottom-right-radius: 5px;
                        border-left: none;
                        background: #000">
                <div style="width: 8px; height: 19px;
                            opacity: ${imageOpacity};
                            background-image: url('${teslaImageUrl}'); 
                            background-position: -351px ${imageOffset-152}px""></div>
            </div>

            <!-- Inner border -->
            <div style="position: relative; top: -23px; left: 0px; margin: 5px;
                        width: 238px; height: 63px;
                        border: 1px solid #aaa;
                        border-radius: 3px">

              <!-- Colored fill state -->
              <div style="position: relative; top: 0px; left: 0px; z-index: 2;
                          width: ${Math.round(2.38 * battery)}px;
                          height: 63px;
                          opacity: 0.9;
                          border-top-left-radius: 2.5px;
                          border-bottom-left-radius: 2.5px;
                          background-color: #068A00"></div>

              <!-- Charge limit marker -->
              <div style="position: relative; top: -63px; left: ${Math.round(2.38 * chargeLimitSOC)-1}px;
                          height: 63px; width: 2px;
                          ${chargeLimitSOC === 0 ? "visibility: hidden" : ""}
                          border-left: 1px dashed #888"></div>
                          
              <!-- State icons -->
              <div style="position: relative; top: -120px; left: 0; text-align: center; z-index: 5">
                ${ renderedStateIcons.join(" ") }
              </div>
              
            </div>
          </div>

        </div>
      </div>
		`;
  }
});
