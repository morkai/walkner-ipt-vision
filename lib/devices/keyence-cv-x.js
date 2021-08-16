// Part of <https://miracle.systems/p/walkner-ipt-vision> licensed under <CC BY-NC-SA 4.0>

'use strict';

const path = require('path');
const childProcess = require('child_process');
const _ = require('lodash');
const waitForFiles = require('./waitForFiles');

module.exports = (app, {stepConfig, device}, done) =>
{
  app.log(`Running ${device.type} step...`);

  const stepResult = {result: false};

  app.stepResults.push(stepResult);

  const command = path.join(app.root, 'bin', 'KeyenceCvXTest', 'KeyenceCvXTest.exe');
  const args = [
    '--host', device.host,
    '--port', device.port || 8502,
    '--program', stepConfig.program || 0
  ];
  const options = {};
  const p = childProcess.spawn(command, args, options);
  let stdout = '';
  let errorCode = 'ERR_STEP_EXIT_CODE';

  p.stdout.setEncoding('utf8');
  p.stdout.on('data', data =>
  {
    stdout += data;
  });

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

  const complete = _.once(done);

  p.on('error', err =>
  {
    complete({
      code: 'ERR_SPAWN',
      message: `KeyenceCvXTest.exe spawning error: ${err.message}`
    });
  });

  p.on('close', code =>
  {
    if (code === 0)
    {
      try
      {
        Object.assign(stepResult, JSON.parse(stdout));

        setImmediate(waitForFiles, app, stepConfig, stepResult, complete);
      }
      catch (err)
      {
        complete({
          code: 'ERR_INVALID_STEP_RESULT',
          message: `Invalid step result JSON: ${err.message}`
        });
      }
    }
    else
    {
      complete({
        code: errorCode,
        message: `KeyenceCvXTest.exe ended with a non-zero exit code: ${code}`
      });
    }
  });
};
