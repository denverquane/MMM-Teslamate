Module.register("MMM-Teslamate", {

  getScripts: function () {
    console.log(this.name + ": getScripts called");
    return [];
  },
  getStyles: function () {
    console.log(this.name + ": getStyles called");
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
      fontSize: '.9rem', // null (to use default/css) or rem/px
      lineHeight: '1.2rem', // null (to use default/css) or rem/px
    },
    displayOptions: {
      odometer: {
        visible: true,
      },
      batteryBar: {
        visible: true,
        topMargin: 0,
      },
      temperatureIcons: {
        topMargin: 0,
      },
      tpms: {
        visible: true,
      },
      speed: {
        visible: true,
      },
      geofence: {
        visible: true,
      },
    },
    showTemps: "hvac_on",
    updatePeriod: 5,
  },

  makeServerKey: function (server) {
    console.log(this.name + ": makeServerKey called with server: ", server);
    return '' + server.address + ':' + (server.port ?? '1883');
  },

  start: function () {
    console.log(this.name + ": start called");
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
      charge_start: topicPrefix + '/scheduled_charging_start_time',
      charge_time: topicPrefix + '/time_to_full_charge',

      update_available: topicPrefix + '/update_available',
      geofence: topicPrefix + '/geofence',
      tpms_pressure_fl: topicPrefix + '/tpms_pressure_fl',
      tpms_pressure_fr: topicPrefix + '/tpms_pressure_fr',
      tpms_pressure_rl: topicPrefix + '/tpms_pressure_rl',
      tpms_pressure_rr: topicPrefix + '/tpms_pressure_rr',
    };

    console.log(this.name + ": Topics initialized");
    this.subscriptions = {
      lat: {},
      lon: {},
    };

    console.log(this.name + ': Setting up connection to server');

    var s = this.config.mqttServer;
    var serverKey = this.makeServerKey(s);
    console.log(this.name + ': Adding config for ' + s.address + ' port ' + s.port + ' user ' + s.user);

    for (let key in Topics) {
      var topic = Topics[key];
      console.log(this.name + ': Subscribing to topic: ' + topic);
      this.subscriptions[key] = {
        topic: topic,
        serverKey: serverKey,
        value: null,
        time: null
      };
    }

    console.log(this.name + ": Subscriptions initialized");
    this.openMqttConnection();
  },

  openMqttConnection: function () {
    console.log(this.name + ": openMqttConnection called");
    this.sendSocketNotification('MQTT_CONFIG', this.config);
  },

  socketNotificationReceived: function (notification, payload) {
    console.log(this.name + ": socketNotificationReceived - Notification: " + notification);
    if (notification === 'MQTT_PAYLOAD') {
      if (payload != null) {
        console.log(this.name + ": MQTT_PAYLOAD received for serverKey: " + payload.serverKey + " and topic: " + payload.topic);
        for (let key in this.subscriptions) {
          let sub = this.subscriptions[key];
          if (sub.serverKey == payload.serverKey && sub.topic == payload.topic) {
            var value = payload.value;
            sub.value = value;
            sub.time = payload.time;

            console.log(this.name + ": Updated subscription for key: " + key + " with value: " + value);

            this.subscriptions[key] = sub;
          }
        }
        this.triggerDomUpdate();
      } else {
        console.log(this.name + ': MQTT_PAYLOAD - No payload');
      }
    }
  },

  triggerDomUpdate: function () {
    console.log(this.name + ": triggerDomUpdate called");
    // Render immediately if we never rendered before or if it's more than 5s ago (configurable)
    if (!this.lastRenderTimestamp || this.lastRenderTimestamp <= (Date.now() - this.config.updatePeriod * 1000)) {
      console.log(this.name + ": Immediate DOM update");
      this.updateDom();
      this.lastRenderTimestamp = Date.now();
    // Schedule a render in 5s if one isn't scheduled already
    } else if (!this.nextRenderTimer) {
      console.log(this.name + ": Scheduling DOM update");
      this.nextRenderTimer = setTimeout(() => {
        this.updateDom();
        this.lastRenderTimestamp = Date.now();
        this.nextRenderTimer = null;
      }, this.config.updatePeriod * 1000);
    }
  },

  getDom: function () {
    console.log(this.name + ": getDom called");
    const kmToMiFixed = function (miles, fixed) {
      return (miles / 1.609344).toFixed(fixed);
    };

    const cToFFixed = function (celcius, fixed) {
      return ((celcius * 9 / 5) + 32).toFixed(fixed);
    };

    const barToPSI = function (bar, fixed) {
      return (bar * 14.503773773).toFixed(fixed);
    };

    const wrapper = document.createElement('div');

    const carName = this.subscriptions["name"].value;
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
    const geofence = this.subscriptions["geofence"].value;

    var idealRange = this.subscriptions["ideal_range"].value ? this.subscriptions["ideal_range"].value : 0;
    var estRange = this.subscriptions["est_range"].value ? this.subscriptions["est_range"].value : 0;
    var speed = this.subscriptions["speed"].value ? this.subscriptions["speed"].value : 0;
    var outside_temp = this.subscriptions["outside_temp"].value ? this.subscriptions["outside_temp"].value : 0;
    var inside_temp = this.subscriptions["inside_temp"].value ? this.subscriptions["inside_temp"].value : 0;
    var odometer = this.subscriptions["odometer"].value ? this.subscriptions["odometer"].value : 0;

    var tpms_pressure_fl = this.subscriptions["tpms_pressure_fl"].value ? this.subscriptions["tpms_pressure_fl"].value : 0;
    var tpms_pressure_fr = this.subscriptions["tpms_pressure_fr"].value ? this.subscriptions["tpms_pressure_fr"].value : 0;
    var tpms_pressure_rl = this.subscriptions["tpms_pressure_rl"].value ? this.subscriptions["tpms_pressure_rl"].value : 0;
    var tpms_pressure_rr = this.subscriptions["tpms_pressure_rr"].value ? this.subscriptions["tpms_pressure_rr"].value : 0;

    if (!this.config.imperial) {
      idealRange = (idealRange * 1.0).toFixed(0);
      estRange = (estRange * 1.0).toFixed(0);
      speed = (speed * 1.0).toFixed(0);
      odometer = (odometer * 1.0).toFixed(0);

      outside_temp = (outside_temp * 1.0).toFixed(1);
      inside_temp = (inside_temp * 1.0).toFixed(1);

      tpms_pressure_fl = (tpms_pressure_fl * 1.0).toFixed(1);
      tpms_pressure_fr = (tpms_pressure_fr * 1.0).toFixed(1);
      tpms_pressure_rl = (tpms_pressure_rl * 1.0).toFixed(1);
      tpms_pressure_rr = (tpms_pressure_rr * 1.0).toFixed(1);
    } else {
      idealRange = kmToMiFixed(idealRange, 0);
      estRange = kmToMiFixed(estRange, 0);
      speed = kmToMiFixed(speed, 0);
      odometer = kmToMiFixed(odometer, 0);

      outside_temp = cToFFixed(outside_temp, 1);
      inside_temp = cToFFixed(inside_temp, 1);

      tpms_pressure_fl = barToPSI(tpms_pressure_fl,1);
      tpms_pressure_fr = barToPSI(tpms_pressure_fr,1);
      tpms_pressure_rl = barToPSI(tpms_pressure_rl,1);
      tpms_pressure_rr = barToPSI(tpms_pressure_rr,1);
    }

    const data = {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning, geofence, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr
    }

    console.log(this.name + ": Generating DOM with data: ", data);
    //always graphic mode
    this.generateGraphicDom(wrapper, data);

    //optionally append the table
    if (this.config.hybridView)
      this.generateTableDom(wrapper, data);

    return wrapper;
  },

  generateTableDom: function (wrapper, data) {
    console.log(this.name + ": generateTableDom called with data: ", data);

    const {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning, geofence, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr
    } = data;

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

    const fontSize = this.config.sizeOptions?.fontSize || '.9rem';
    const lineHeight = this.config.sizeOptions?.lineHeight || '1.2rem';
    const lineStyle = 'font-size: ' + fontSize + ';line-height: ' + lineHeight + ';';

    var attrList = document.createElement("ul");
    attrList.className = "mattributes";

    if (charging) {
      var energyAddedLi = document.createElement("li");
      energyAddedLi.className = "mattribute";
      energyAddedLi.style = lineStyle;
      energyAddedLi.appendChild(makeSpan("icon zmdi zmdi-input-power zmdi-hc-fw", ""));
      energyAddedLi.appendChild(makeSpan("name", "Charge Added"));
      energyAddedLi.appendChild(makeSpan("value", energyAdded + " kWh"));

      var timeToFullLi = document.createElement("li");
      timeToFullLi.className = "mattribute";
      timeToFullLi.style = lineStyle;
      timeToFullLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
      timeToFullLi.appendChild(makeSpan("name", "Time to " + chargeLimitSOC + "%"));
      timeToFullLi.appendChild(makeSpan("value", makeChargeRemString(timeToFull)));
      attrList.appendChild(energyAddedLi);
      attrList.appendChild(timeToFullLi);
    } else if (pluggedIn && chargeStart && chargeStart !== "") {
      var chargeStartLi = document.createElement("li");
      chargeStartLi.className = "mattribute";
      chargeStartLi.style = lineStyle;
      chargeStartLi.appendChild(makeSpan("icon zmdi zmdi-time zmdi-hc-fw", ""));
      chargeStartLi.appendChild(makeSpan("name", "Charge Starting"));
      chargeStartLi.appendChild(makeSpan("value", makeChargeStartString(chargeStart)));
      attrList.appendChild(chargeStartLi);
    }

    if (this.config.displayOptions?.odometer?.visible ?? true) {
      var odometerLi = document.createElement("li");
      odometerLi.className = "mattribute";
      odometerLi.style = lineStyle;
      odometerLi.appendChild(makeSpan("icon zmdi zmdi-dot-circle-alt zmdi-hc-fw", ""));
      odometerLi.appendChild(makeSpan("name", "Odometer"));
      odometerLi.appendChild(makeSpan("value", odometer + (!this.config.imperial ? " km" : " mi")));

      attrList.appendChild(odometerLi);
    }
   
    if (this.config.displayOptions?.tpms?.visible ?? true) {
      var tpmsLi = document.createElement("li");
      tpmsLi.className = "mattribute";
      tpmsLi.style = lineStyle;
      tpmsLi.appendChild(makeSpan("icon zmdi zmdi-star-circle zmdi-hc-fw", ""));
      tpmsLi.appendChild(makeSpan("name", "TPMS"));
      tpmsLi.appendChild(makeSpan("value", tpms_pressure_fl + ",  " + tpms_pressure_fr + ",  " + tpms_pressure_rl + ",  " + tpms_pressure_rr + (!this.config.imperial ? " (bar)" : " (psi)")));

      attrList.appendChild(tpmsLi);
    }

    if ((this.config.displayOptions?.geofence?.visible ?? true) && geofence !== null && geofence !== "") {
      var geofenceLi = document.createElement("li");
      geofenceLi.className = "mattribute";
      geofenceLi.style = lineStyle;
      geofenceLi.appendChild(makeSpan("icon zmdi zmdi-my-location zmdi-hc-fw", ""));
      geofenceLi.appendChild(makeSpan("name", "Location"));
      geofenceLi.appendChild(makeSpan("value", geofence));

      attrList.appendChild(geofenceLi);
    }

    if ((this.config.displayOptions?.speed?.visible ?? true) && state == "driving") {
      var speedLi = document.createElement("li");
      speedLi.className = "mattribute";
      speedLi.style = lineStyle;
      speedLi.appendChild(makeSpan("icon zmdi zmdi-run zmdi-hc-fw", ""));
      speedLi.appendChild(makeSpan("name", "Speed"));
      speedLi.appendChild(makeSpan("value", speed + (!this.config.imperial ? " km/h" : " mph")));

      attrList.appendChild(speedLi);
    }

    wrapper.appendChild(attrList);
  },

  generateGraphicDom: function (wrapper, data) {
    console.log(this.name + ": generateGraphicDom called with data: ", data);

    const {
      carName, state, latitude, longitude, battery, chargeLimitSOC,
      chargeStart, timeToFull, pluggedIn, energyAdded, locked, sentry,
      idealRange, estRange, speed, outside_temp, inside_temp, odometer,
      windowsOpen, batteryUsable, isClimateOn, isHealthy, charging,
      doorsOpen, trunkOpen, frunkOpen, isUserPresent, isUpdateAvailable,
      isPreconditioning, geofence, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr
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
    const layWidth = this.config.sizeOptions?.width ?? 450; // px, default: 450
    const layHeight = this.config.sizeOptions?.height ?? 203; // px, default: 203
    // the battery images itself
    const layBatWidth = this.config.sizeOptions?.batWidth ?? 250; // px, default: 250
    const layBatHeight = this.config.sizeOptions?.batHeight ?? 75; // px, default: 75
    const layBatTopMargin = this.config.displayOptions?.batteryBar?.topMargin ?? 0; // px, default: 0
    // top offset - to reduce visual distance to the module above
    const topOffset = this.config.sizeOptions?.topOffset ?? -40; // px, default: -40

    // calculate scales
    var layBatScaleWidth = layBatWidth / 250;  // scale factor normalized to 250
    var layBatScaleHeight = layBatHeight / 75; // scale factor normalized to 75
    var layScaleWidth = layWidth / 450;        // scale factor normalized to 450
    var layScaleHeight = layHeight / 203;      // scale factor normalized to 203

    const teslaModel = this.config.carImageOptions?.model ?? "m3";
    const teslaView = this.config.carImageOptions?.view ?? "STUD_3QTR";
    const teslaOptions = this.config.carImageOptions?.options ?? "PPSW,W32B,SLR1";

    const teslaImageWidth = 720; // Tesla compositor stopped returning arbitrary-sized images, only steps of 250, 400, 720 etc work now. We use CSS to scale the image to the correct layout width
    const teslaImageUrl = `https://static-assets.tesla.com/v1/compositor/?model=${teslaModel}&view=${teslaView}&size=${teslaImageWidth}&options=${teslaOptions}&bkba_opt=1`;
    const imageOffset = this.config.carImageOptions?.verticalOffset ?? 0;
    const imageOpacity = this.config.carImageOptions?.imageOpacity ?? 0.4;
    const imageWidth = layWidth * (this.config.carImageOptions?.scale ?? 1);

    const renderedStateIcons = stateIcons.map((icon) => `<span class="mdi mdi-${icon}"></span>`)
    const renderedNetworkIcons = networkIcons.map((icon) => `<span class="mdi mdi-${icon}" ${icon == "alert-box" ? "style='color: #f66'" : ""}></span>`)

    const batteryReserveVisible = (battery - batteryUsable) > 1; // at <= 1% reserve the app and the car don't show it, so we won't either

    const batteryOverlayIcon = charging ? `<span class="mdi mdi-flash bright light"></span>` :
      batteryReserveVisible ? `<span class="mdi mdi-snowflake bright light"></span>` : '';

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

    let batteryBarHtml = '';
    if (this.config.displayOptions?.batteryBar?.visible ?? true) {
      batteryBarHtml = `
        <!-- Battery graphic - outer border -->
        <div style="margin-left: ${(layWidth - layBatWidth) / 2}px;
                    width: ${layBatWidth}px; height: ${layBatHeight}px;
                    margin-top: ${layBatTopMargin}px;
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
                          background-size: ${imageWidth}px;
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
      `;
    }

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
                    background-size: ${imageWidth}px;;
                    background-repeat: no-repeat;
                    background-position: center ${imageOffset}px;"></div>
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

          ${batteryBarHtml}

          <!-- Optional graphic mode icons below the car -->
          <div style="text-align: center; 
                      margin-top: ${this.config.displayOptions?.temperatureIcons?.topMargin ?? 0}px;
                      ${temperatureIcons == "" ? 'display: none;' : ''}
                      ${state == "offline" || state == "asleep" || state == "suspended" ? 'opacity: 0.3;' : ''}">
            ${temperatureIcons}
          </div>
        </div>
      </div>
		`;
  }
});