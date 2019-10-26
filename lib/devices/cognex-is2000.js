'use strict';

const path = require('path');
const childProcess = require('child_process');
const dgram = require('dgram');
const _ = require('lodash');
const step = require('h5.step');
const waitForFiles = require('./waitForFiles');

module.exports = (app, {stepConfig, device}, done) =>
{
  app.log(`Running ${device.type} step...`);

  const stepResult = {result: false};

  app.stepResults.push(stepResult);

  step(
    function()
    {
      app.log(`Binding UDP to ${device.udp.host}:${device.udp.port}...`);

      this.stepResultRecieved = false;
      this.socket = dgram.createSocket('udp4');

      this.socket.on('error', err =>
      {
        app.log(`UDP error: ${err.message}`);
      });

      this.socket.once('message', message =>
      {
        app.log('Received step results.');

        this.stepResultRecieved = true;

        message
          .toString()
          .replace(/[\u0000\r\n]+/g, '') // eslint-disable-line no-control-regex
          .trim()
          .split('\t')
          .forEach(result =>
          {
            let [key, value] = result.split('=');

            key = key.trim();
            value = value.trim();

            const num = parseFloat(value);

            if (!isNaN(num))
            {
              value = num;
            }

            if (/pass|result/.test(key))
            {
              key = key.replace('pass', 'result');
              value = value === 1;
            }

            stepResult[key] = value;
          });

        if (this.onStepResult)
        {
          this.onStepResult();
        }
      });

      this.socket.bind(device.udp.port, device.udp.host, this.next());
    },
    function(err)
    {
      if (err)
      {
        return this.skip({
          code: 'ERR_UDP_BIND',
          message: `Failed to bind UDP: ${err.messsage}`
        });
      }

      const command = path.join(app.root, 'bin', 'CognexTest', 'CognexTest.exe');
      const args = [
        '--host', device.host,
        '--user', device.user || 'admin',
        '--pass', device.pass || '',
        '--program', stepConfig.program || ''
      ];
      const options = {};
      const p = childProcess.spawn(command, args, options);
      let errorCode = 'ERR_STEP_EXIT_CODE';

      p.stderr.setEncoding('utf8');
      p.stderr.on('data', data =>
      {
        data.trim().split('\r\n').forEach(line =>
        {
          if (line.startsWith('ERR_'))
          {
            errorCode = line;
          }
          else
          {
            app.log(line);
          }
        });
      });

      const next1 = _.once(this.parallel());
      const next2 = _.once(this.parallel());
      let error = false;
      const fail = err =>
      {
        error = true;
        next1(err);
        next2();
      };

      p.on('error', err =>
      {
        error = true;

        fail({
          code: 'ERR_SPAWN',
          message: `CognexTest.exe spawning error: ${err.message}`
        });
      });

      p.on('close', code =>
      {
        if (error)
        {
          return;
        }

        if (code !== 0)
        {
          return fail({
            code: errorCode,
            message: `CognexTest.exe ended with a non-zero exit code: ${code}`
          });
        }

        next1();

        if (!this.stepResultRecieved)
        {
          app.log('Waiting for step results...');

          this.onStepResult = next2;

          setTimeout(next2, device.waitForResults || app.config.waitForResults || 5000);
        }
        else
        {
          next2();
        }
      });
    },
    function(err)
    {
      if (err)
      {
        return this.skip(err);
      }

      if (!this.stepResultRecieved)
      {
        return this.skip({
          code: 'ERR_INVALID_STEP_RESULT',
          message: `No step results received.`
        });
      }

      this.socket.removeAllListeners();
      this.socket.close();
      this.socket = null;

      setImmediate(waitForFiles, app, stepConfig, stepResult, done);
    }
  );
};
