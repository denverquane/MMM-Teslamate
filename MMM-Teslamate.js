Module.register("MMM-Teslamate", {

  getScripts: function () {
    return [];
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
    rangeDisplay: "%",
    imperial: false,
    carID: '1',
    sizeOptions: {
      width: 450,
      height: 203,
      batWidth: 250,
      batHeight: 75,
      topOffset: -40,
    },
    showTemps: "hvac_on",
  },

  makeServerKey: function (server) {
    return '' + server.address + ':' + (server.port ?? '1883');
  },

  start: function () {
    const topicPrefix = 'teslamate/cars/' + this.config.carID;

    const Topics = {
      name: topicPrefix + '/display_name',
      state: topicPrefix + '/state',
      health: topicPrefix + '/healthy',

      lat: topicPrefix + '/latitude',
      lon: topicPrefix + '/longitude',
      shift_state: topicPrefix + '/shift_state',
      speed: topicPrefix + '/speed',

      locked: topicPrefix + '/locked',
      sentry: topicPrefix + '/sentry_mode',
      windows: topicPrefix + '/windows_open',
      doors: topicPrefix + '/doors_open',
      trunk: topicPrefix + '/trunk_open',
      frunk: topicPrefix + '/frunk_open',
      user: topicPrefix + '/is_user_present',

      outside_temp: topicPrefix + '/outside_temp',
      inside_temp: topicPrefix + '/inside_temp',
      climate_on: topicPrefix + '/is_climate_on',
      preconditioning: topicPrefix + '/is_preconditioning',

      odometer: topicPrefix + '/odometer',
      ideal_range: topicPrefix + '/ideal_battery_range_km',
      est_range: topicPrefix + '/est_battery_range_km',
      rated_range: topicPrefix + '/rated_battery_range_km',

      battery: topicPrefix + '/battery_level',
      battery_usable: topicPrefix + '/usable_battery_level',
      plugged_in: topicPrefix + '/plugged_in',
      charge_added: topicPrefix + '/charge_energy_added',
      charge_limit: topicPrefix + '/charge_limit_soc',
      // charge_port: 'teslamate/cars/1/charge_port_door_open',
      // charge_current: 'teslamate/cars/1/charger_actual_current',
      // charge_phases: 'teslamate/cars/1/charger_phases',
      // charge_power: 'teslamate/cars/1/charger_power',
      // charge_voltage: 'teslamate/cars/1/charger_voltage',
      charge_start: topicPrefix + '/scheduled_charging_start_time',
      charge_time: topicPrefix + '/time_to_full_charge',

      update_available: topicPrefix + '/update_available',
    };

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

  },

  openMqttConnection: function () {
    this.sendSocketNotification('MQTT_CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_PAYLOAD') {
      if (payload != null) {
        for (let key in this.subscriptions) {
          sub = this.subscriptions[key];
          //console.log(sub);
          if (sub.serverKey == payload.serverKey && sub.topic == payload.topic) {
            var value = payload.value;
            sub.value = value;
            sub.time = payload.time;

            this.subscriptions[key] = sub;
          }
        }
        this.updateDom();
      } else {
        console.log(this.name + ': MQTT_PAYLOAD - No payload');
      }
    }
  },

  getDom: function () {
    const kmToMiFixed = function (miles, fixed) {
      return (miles / 1.609344).toFixed(fixed);
    };

    const cToFFixed = function (celcius, fixed) {
      return ((celcius * 9 / 5) + 32).toFixed(fixed);
    };
    const wrapper = document.createElement('div');

    const carName = this.subscriptions["name"].value;
    //TODO is this interesting to see displayed?
    const state = this.subscriptions["state"].value;
    const latitude = this.subscriptions["lat"].value;
    const longitude = this.subscriptions["lon"].value;
    const battery = this.subscriptions["battery"].value;
    const batteryUsable = this.subscriptions["battery_usable"].value;
    const chargeLimitSOC = this.subscriptions["charge_limit"].value;

    const chargeStart = this.subscriptions["charge_start"].value;
    const timeToFull = this.subscriptions["charge_time"].value;
    const pluggedIn = this.subscriptions["plugged_in"].value;
    const charging = pluggedIn && timeToFull > 0.0;
    const energyAdded = this.subscriptions["charge_added"].value;
    const locked = this.subscriptions["locked"].value;
    const sentry = this.subscriptions["sentry"].value;
    const windowsOpen = this.subscriptions["windows"].value;
    const doorsOpen = this.subscriptions["doors"].value;
    const trunkOpen = this.subscriptions["trunk"].value;
    const frunkOpen = this.subscriptions["frunk"].value;
    const isUserPresent = this.subscriptions["user"].value;
    const isClimateOn = this.subscriptions["climate_on"].value;
    const isPreconditioning = this.subscriptions["preconditioning"].value;
    const isHealthy = this.subscriptions["health"].value;
    const isUpdateAvailable = this.subscriptions["update_available"].value;

    //const gUrl = "https://www.google.com/maps/embed/v1/place?key=" + this.config.gMapsApiKey + "&q=" + latitude + "," + longitude + "&zoom=" + this.config.mapZoomLevel;

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
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning
    }

    //always graphic mode
    this.generateGraphicDom(wrapper, data);

    //optionally append the table
    if (this.config.hybridView)
      this.generateTableDom(wrapper, data);

    return wrapper;
  },

  generateTableDom: function (wrapper, data) {
    const {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning
    } = data;

    //const getBatteryLevelClass = function (bl, warn, danger) {
    //  if (bl < danger) {
    //    return 'danger';
    //  }
    //  if (bl < warn) {
    //    return 'warning';
    //  }
    //  if (bl >= warn) {
    //    return 'ok';
    //  }
    //  return '';
    //};

    const makeSpan = function (className, content) {
      var span = document.createElement("span");
      span.className = className;
      span.innerHTML = content;
      return span;
    }

    const makeChargeStartString = function (input) {
      const diffMs = (Date.parse(input) - Date.now());
      var diffDays = Math.floor(diffMs / 86400000);
      var diffHrs = Math.floor((diffMs % 86400000) / 3600000);
      var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
      var returnStr = (diffDays > 0 ? (diffDays + " Days, ") : "");
      returnStr += (diffHrs > 0 ? (diffHrs + " Hour" + (diffHrs > 1 ? "s" : "") + ", ") : "");
      return returnStr + (diffMins > 0 ? (diffMins + " Min" + (diffMins > 1 ? "s" : "")) : "");
    }

    //TODO bother formatting days? Poor trickle chargers...
    const makeChargeRemString = function (remHrs) {
      const hrs = Math.floor(remHrs);
      const mins = Math.ceil((remHrs - hrs) * 60.0);

      return (hrs > 0 ? (hrs + " Hour" + (hrs > 1 ? "s" : "") + ", ") : "") + (mins > 0 ? (mins + " Min" + (mins > 1 ? "s" : "")) : "");
    }

    //var title = document.createElement("h2");
    //title.className = "mqtt-title";
    //var iconSpan = document.createElement("span");

    //TODO does this need to be "classlist"?
    //iconSpan.className = "zmdi zmdi-car zmdi-hc-2x icon"
    //title.innerHTML = carName;
    //title.prepend(iconSpan);

    //wrapper.appendChild(title);

    var attrList = document.createElement("ul");
    attrList.className = "mattributes";

    //attrList.appendChild(rangeCompare);

    if (charging) {
      var energyAddedLi = document.createElement("li");
      energyAddedLi.className = "mattribute";
      energyAddedLi.appendChild(makeSpan("icon zmdi zmdi-input-power zmdi-hc-fw", ""));
      energyAddedLi.appendChild(makeSpan("name", "Charge Added"));
      energyAddedLi.appendChild(makeSpan("value", energyAdded + " kWh"));

      var timeToFullLi = document.createElement("li");
      timeToFullLi.className = "mattribute";
      timeToFullLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
      timeToFullLi.appendChild(makeSpan("name", "Time to " + chargeLimitSOC + "%"));
      timeToFullLi.appendChild(makeSpan("value", makeChargeRemString(timeToFull)));
      attrList.appendChild(energyAddedLi);
      attrList.appendChild(timeToFullLi);
    } else if (pluggedIn && chargeStart && chargeStart !== "") {
      var chargeStartLi = document.createElement("li");
      chargeStartLi.className = "mattribute";
      chargeStartLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
      chargeStartLi.appendChild(makeSpan("name", "Charge Starting"));
      chargeStartLi.appendChild(makeSpan("value", makeChargeStartString(chargeStart)));
      attrList.appendChild(chargeStartLi);
    }

    var odometerLi = document.createElement("li");
    odometerLi.className = "mattribute";
    odometerLi.appendChild(makeSpan("icon zmdi zmdi-dot-circle-alt zmdi-hc-fw", ""));
    odometerLi.appendChild(makeSpan("name", "Odometer"));
    odometerLi.appendChild(makeSpan("value", odometer + (!this.config.imperial ? " Km" : " Mi")));

    attrList.appendChild(odometerLi);
    wrapper.appendChild(attrList);
  },

  generateGraphicDom: function (wrapper, data) {
    const {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry, gUrl,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning
    } = data;

    const stateIcons = [];
    if (state == "asleep" || state == "suspended")
      stateIcons.push("power-sleep");
    if (state == "suspended")
      stateIcons.push("timer-sand");
    if (state == "driving")
      stateIcons.push("steering");
    if (pluggedIn == "true")
      stateIcons.push("power-plug");
    if (locked == "false")
      stateIcons.push("lock-open-variant");
    if (sentry == "true")
      stateIcons.push("cctv");
    if (windowsOpen == "true")
      stateIcons.push("window-open");
    if (isUserPresent == "true")
      stateIcons.push("account");
    if (doorsOpen == "true" || trunkOpen == "true" || frunkOpen == "true")
      stateIcons.push("car-door");
    if (isClimateOn == "true" || isPreconditioning == "true")
      stateIcons.push("air-conditioner");

    const networkIcons = [];
    if (state == "updating")
      networkIcons.push("cog-clockwise");
    else if (isUpdateAvailable == "true")
      networkIcons.push("gift");
    if (isHealthy != "true")
      networkIcons.push("alert-box");
    networkIcons.push((state == "offline") ? "signal-off" : "signal");

    // size options
    // size of the icons + battery (above text)
    const layWidth = this.config.sizeOptions.width || 450; // px, default: 450
    const layHeight = this.config.sizeOptions.height || 203; // px, default: 203
    // the battery images itself
    const layBatWidth = this.config.sizeOptions.batWidth || 250; // px, default: 250
    const layBatHeight = this.config.sizeOptions.batHeight || 75; // px, default: 75
    // top offset - to reduce visual distance to the module above
    const topOffset = this.config.sizeOptions.topOffset || -40; // px, default: -40

    // calculate scales
    var layBatScaleWidth = layBatWidth / 250;  // scale factor normalized to 250
    var layBatScaleHeight = layBatHeight / 75; // scale factor normalized to 75
    var layScaleHeight = layHeight / 203; // scale factor normalized to 203

    const teslaModel = this.config.carImageOptions.model || "m3";
    const teslaView = this.config.carImageOptions.view || "STUD_3QTR";
    const teslaOptions = this.config.carImageOptions.options || "PPSW,W32B,SLR1";

    const teslaImageUrl = `https://static-assets.tesla.com/v1/compositor/?model=${teslaModel}&view=${teslaView}&size=${layWidth}&options=${teslaOptions}&bkba_opt=1`;
    const imageOffset = this.config.carImageOptions.verticalOffset || 0;
    const imageOpacity = this.config.carImageOptions.imageOpacity || 0.4;

    const renderedStateIcons = stateIcons.map((icon) => `<span class="mdi mdi-${icon}"></span>`)
    const renderedNetworkIcons = networkIcons.map((icon) => `<span class="mdi mdi-${icon}" ${icon == "alert-box" ? "style='color: #f66'" : ""}></span>`)

    const batteryReserveVisible = (battery - batteryUsable) > 1; // at <= 1% reserve the app and the car don't show it, so we won't either

    const batteryOverlayIcon = charging ? `<span class="mdi mdi-flash bright light"></span>` :
      batteryReserveVisible ? `<span class="mdi mdi-snowflake bright light"></span>` :
        '';

    const batteryBigNumber = this.config.rangeDisplay === "%" ? batteryUsable : idealRange;
    const batteryUnit = this.config.rangeDisplay === "%" ? "%" : (this.config.imperial ? "mi" : "km");

    const showTemps = ((this.config.showTemps === "always") || 
                       (this.config.showTemps === "hvac_on" && (isClimateOn == "true" || isPreconditioning == "true"))) &&
                      (inside_temp && outside_temp);
    const temperatureIcons = !showTemps ? "" :
      `<span class="mdi mdi-car normal small"></span>
       <span class="bright light small">${inside_temp}°</span>
       &nbsp;&nbsp;
       <span class="mdi mdi-earth normal small"></span>
       <span class="bright light small">${outside_temp}°</span>`;

    wrapper.innerHTML = `
      <div style="width: ${layWidth}px; height: ${layHeight}px;">
        <link href="https://cdn.materialdesignicons.com/4.8.95/css/materialdesignicons.min.css" rel="stylesheet" type="text/css"> 
        <div style="z-index: 1; 
                    position: relative; top: 0px; left: 0px; 
                    margin-top: ${topOffset}px;
                    margin-bottom: -${layHeight}px;
                    width: ${layWidth}px; height: ${layHeight}px; 
                    opacity: ${imageOpacity}; 
                    background-image: url('${teslaImageUrl}'); 
                    background-position: 0px ${imageOffset}px;"></div>
        <div style="z-index: 2; position: relative; top: 0px; left: 0px; margin-top: ${topOffset}px;">

          <!-- Percentage/range -->
          <div style="margin-top: ${50 * layScaleHeight}px; 
                      margin-left: auto; 
                      text-align: center; 
                      width: ${layWidth}px; 
                      height: 70px">
            <span class="bright large light">${batteryBigNumber}</span><span class="normal medium">${batteryUnit}</span>
          </div>

          <!-- State icons -->
          <div style="float: left; 
                      margin-top: -${65 * layScaleHeight}px; 
                      margin-left: ${((layWidth - layBatWidth) / 2) - 5}px; 
                      text-align: left; ${state == "offline" ? 'opacity: 0.3;' : ''}" 
               class="small">
            ${renderedStateIcons.join(" ")}
          </div>

          <!-- Online state icon -->
          <div style="float: right; 
                      margin-top: -${65 * layScaleHeight}px; 
                      margin-right: ${((layWidth - layBatWidth) / 2) - 5}px; 
                      text-align: right;" 
               class="small">
            ${renderedNetworkIcons.join(" ")}
          </div>

          <!-- Battery graphic - outer border -->
          <div style="margin-left: ${(layWidth - layBatWidth) / 2}px;
                      width: ${layBatWidth}px; height: ${layBatHeight}px;
                      border: 2px solid #aaa;
                      border-radius: ${10 * layBatScaleHeight}px">

            <!-- Plus pole -->
            <div style="position: relative; top: ${(layBatHeight - layBatHeight / 4) / 2 - 1}px; left: ${layBatWidth}px;
                        width: ${8 * layBatScaleWidth}px; height: ${layBatHeight / 4}px;
                        border: 2px solid #aaa;
                        border-top-right-radius: ${5 * layBatScaleHeight}px;
                        border-bottom-right-radius: ${5 * layBatScaleHeight}px;
                        border-left: none;
                        background: #000">
                <div style="width: ${8 * layBatScaleWidth}px; height: ${layBatHeight / 4}px;
                            opacity: ${imageOpacity};
                            background-image: url('${teslaImageUrl}');
                            background-position: -351px ${imageOffset - 152}px"></div>
            </div>

            <!-- Inner border -->
            <div style="position: relative; 
                        top: -${23 * layBatScaleHeight}px; 
                        left: 0px;
	                      margin-left: 5px;
			                  margin-top: ${5 * layBatScaleHeight}px;
                        width: ${(layBatWidth - 12)}px; height: ${layBatHeight - 8 - 2 - 2}px;
                        border: 1px solid #aaa;
                        border-radius: ${3 * layBatScaleHeight}px">

              <!-- Green charge rectangle -->
              <div style="position: relative; top: 0px; left: 0px; z-index: 2;
                          width: ${Math.round(layBatScaleWidth * 2.38 * batteryUsable)}px;
                          height: ${layBatHeight - 8 - 2 - 2}px;
                          opacity: 0.8;
                          border-top-left-radius: ${2.5 * layBatScaleHeight}px;
                          border-bottom-left-radius: ${2.5 * layBatScaleHeight}px;
                          background-color: #068A00"></div>

              <!-- Blue reserved charge rectangle -->
              <div style="position: relative; 
                          top: -${layBatHeight - 8 - 2 - 2}px; 
                          left: ${Math.round(layBatScaleWidth * 2.38 * batteryUsable)}px; 
                          z-index: 2;
                          width: ${Math.round(layBatScaleWidth * 2.38 * (battery - batteryUsable))}px;
                          visibility: ${batteryReserveVisible ? 'visible' : 'hidden'};
                          height: ${layBatHeight - 8 - 2 - 2}px;
                          opacity: 0.8;
                          border-top-left-radius: 2.5px;
                          border-bottom-left-radius: 2.5px;
                          background-color: #366aa5"></div>

              <!-- Charge limit marker -->
              <div style="position: relative; 
                          top: -${(layBatHeight - 8 - 2 - 2) * 2}px; 
                          left: ${Math.round(layBatScaleWidth * 2.38 * chargeLimitSOC) - 1}px;
                          height: ${layBatHeight - 8 - 2 - 2}px; width: 2px;
                          ${chargeLimitSOC === 0 ? "visibility: hidden" : ""}
                          border-left: 1px dashed #888"></div>

              <!-- Battery overlay icon (charging or snowflake) -->
              <div class="medium"
                   style="position: relative; 
                          top: -${(layBatHeight - 8 * layBatScaleHeight - 2 - 2) * 2 + 56 * layBatScaleHeight}px; 
                          left: 0; 
                          text-align: center; 
                          z-index: 5">
                ${batteryOverlayIcon}
              </div>

            </div>
          </div>

          <!-- Optional graphic mode icons below the car -->
          <div style="text-align: center; 
                      ${temperatureIcons == "" ? 'display: none;' : ''}
                      ${state == "offline" || state == "asleep" || state == "suspended" ? 'opacity: 0.3;' : ''}">
            ${temperatureIcons}
          </div>
        </div>
      </div>
		`;
  }
});
