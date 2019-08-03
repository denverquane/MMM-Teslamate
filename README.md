# MMM-Teslamate
Magic Mirror Module for the Teslamate utility

# :warning: WORK IN PROGRESS :warning:

## Installation

Requires an active installation of [Teslamate](https://github.com/adriankumpf/teslamate), with the MQTT (mosquitto) publisher configured.


## Configuration

```
{
    module: 'MMM-Teslamate',
   	position: 'bottom_left',
    config: {
        mqttServers: [
            {
                address: '192.168.1.8',  // Server address or IP address
                port: '1883'          // Port number if other than default
                //user: 'user',          // Leave out for no user
                //password: 'password',  // Leave out for no password
            }
        ]
    }
},
```