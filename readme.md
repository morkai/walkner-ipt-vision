# Walkner IPT Vision

## Configuration

Configuration file is specific to a production line and contains info
about the FTP server and available devices (vision sensors/cameras).

First the app tries to read `config.production.json` from the app's
root directory and fallbacks to `config.json` if it doesn't exist.

The config file has the following structure:

```json
{
  "writeLastImage": "{root}/last.webp",
  "waitForResults": 5000,
  "ftp": {
    "enabled": true,
    "url": "ftp://10.13.37.250:21",
    "user": "walkner",
    "pass": "Walkner1",
    "root": "{root}/ftp",
    "waitForFiles": 10000
  },
  "devices": {
    "test-keyence-1": {
      "type": "keyence-iv-hg",
      "host": "10.13.37.150",
      "port": 44818
    },
    "test-keyence-2": {
      "type": "keyence-cv-x",
      "host": "10.13.37.151",
      "port": 8502
    },
    "test-cognex-1": {
      "type": "cognex-is2000",
      "host": "10.13.37.152",
      "user": "admin",
      "pass": "",
      "udp": {
        "host": "10.13.37.250",
        "port": 3000
      },
      "waitForResults": 5000
    }
  }
}
```

where:

* `writeLastImage` - a path to the last uploaded image file or `null`.
  For debugging purposes.
* `waitForResults` - a maximum number of milliseconds after a trigger
  to wait for results from the device.
* `ftp.enabled` - whether the FTP server is used to collect image files.
* `ftp.url` - an address and a port of the FTP server. The local FTP server
  will be listening on the specified address and port. The same address
  and port must be configured in the devices.
* `ftp.user` - a user name used during the FTP authentication. The same
  name must be configured in the devices.
* `ftp.pass` - a user password used during the FTP authentication.
  The same name must be configured in the devices.
* `ftp.root` - a path to a directory where the uploaded image files will be
  stored. `{root}` is replaced by the path to the app's root directory.
* `ftp.waitForFiles` - a maximum number of milliseconds after a trigger
  to wait for image files from the device.
* `devices` - an map of device IDs to definitions. Each device must specify
  a supported `type`.

Device properties depend on its `type`:

* `keyence-iv-hg`:
  * `host` - an address of the device.
  * `port` - an EtherNet/IP TCP port that the device is listening on.
* `keyence-cv-x`:
  * `host` - an address of the device.
  * `port` - a PC Program TCP port that the device is listening on.
* `cognex-is2000`:
  * `host` - an address of the device,
  * `user` - a device username to log in as,
  * `pass` - a password for the specified user,
  * `udp.host` - an address to listen for results on,
  * `udp.port` - a port to listen for results on,
  * `waitForResults` - a per-device override for the global `waitForResults`.
  
If the image data will be collected, then the FTP server Windows service
must be installed by running `ftp-server.install.bat`. The service can be
removed by running `ftp-server.uninstall.bat`. The FTP server is not needed
for `keyence-cv-x`, because the image is downloaded directly from the vision
system.

## Running

The app can be run by executing the `run.bat` script with a path to the
input JSON as the first argument:

```
run.bat C:\Temp\walkner-ipt-vision-input.json
```

The input file has the following structure:

```json
{
  "steps": [
    {
      "device": "test-keyence-1",
      "program": 0,
      "tools": 16
    },
    {
      "device": "test-keyence-2",
      "program": 1
    },
    {
      "device": "test-cognex-1",
      "program": "test-program-name"
    }
  ]
}
```

where:

* `steps` - a list of steps to execute. Each step must specify a `device`
  ID on which the step should be run. The device must exist in the local
  config file.

Additional step properties depend on the type of the used device:

* `keyence-iv-hg`:
  * `program` - a program number between 0 and 31 to select (0 is the first
    program). 
  * `tools` - a number of tool results to include along with the overall
    step result. Defaults to 0, max is 16.
* `keyence-cv-x`:
  * `program` - a program number between 0 and 999 to select (0 is the first
    program).
* `cognex-is2000`:
  * `program` - a job defined in the device to select
    (`.JOB` extension is optional).

The app writes debug messages to the stderr and the results JSON to the
stdout.

If there are any errors the app will exit with code 1 and the results JSON
will have the following structure:

```json
{
  "result": "failure",
  "error": "ERR_INVALID_CONFIG"
}
```

where:

* `result` - always `failure`.
* `error` - an error code. A more detailed error message is written to
  the stderr.

If there weren't any errors the app will exit with code 0 and the results
JSON will have the following structure:

```json
{
  "result": "success",
  "judgement": true,
  "steps": [
    {
      "result": true,
      "program": 0,
      "processingTime": 107,
      "image": null,
      "tools": [
        {
          "result": true,
          "matchingRate": 100,
          "lowerThreshold": 80,
          "upperThreshold": 120
        }
      ]
    }
  ]
}
```

where:

* `result` - always `success`.
* `judgement` - the overall judgement. `true` if the `result` property
  of all `steps` is `true`.
* `steps` - a list of results for each step defined in the input file.
* `steps.result` - whether the step passed.
* `steps.image` - an image uploaded to the FTP by the device, converted
  to WebP and Base64 encoded.

Each step can have additional properties depending on the type of the
device:

* `keyence-iv-hg`:
  * `program` - a program number during judgement.
  * `processingTime` - a number of milliseconds that the device took to
    run the program.
  * `tools` - a list of detailed results for each tool used in the
    program. Included only if the `tools` property is specified in the
    input JSON.
  * `tools.result` - whether the tool passed.
  * `tools.matchingRate` - the matching rate reported by the device.
  * `tools.lowerThreshold` - the lower threshold defined in the tool.
  * `tools.upperThreshold` - the upper threshold defined in the tool.
* `keyence-cv-x` - extra properties correspond to values sent by the
  the device as part of the result log response (each `key=value` pair
  must be separated by a comma `,`).
* `cognex-is2000` - extra properties correspond to values sent by the
  the device as part of the results UDP frame (each `key=value` pair
  must be separated by a tab `\t`).
