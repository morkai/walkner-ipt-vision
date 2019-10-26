'use strict';

const path = require('path');
const fs = require('fs');
const step = require('h5.step');
const devices = require('./devices');

const app = global.app = {
  root: path.resolve(__dirname, '..'),
  input: {},
  config: {},
  stepResults: [],
  log
};

step(
  function()
  {
    log(`Reading input JSON: ${process.argv[2]}`);

    try
    {
      Object.assign(app.input, JSON.parse(fs.readFileSync(process.argv[2])));
    }
    catch (err)
    {
      return this.skip({
        code: 'ERR_INVALID_INPUT',
        message: `Failed to read the input JSON: ${err.message}`
      });
    }

    if (!Array.isArray(app.input.steps) || !app.input.steps.length)
    {
      return this.skip({
        code: 'ERR_INVALID_INPUT',
        message: `No steps in the input JSON.`
      });
    }
  },
  function()
  {
    log('Reading config.production.json...');

    try
    {
      Object.assign(app.config, require(`${app.root}/config.production.json`));
    }
    catch (err)
    {
      log('Reading config.json...');

      try
      {
        Object.assign(app.config, require(`${app.root}/config.json`));
      }
      catch (err)
      {
        return this.skip({
          code: 'ERR_INVALID_CONFIG',
          message: `Failed to read the config JSON: ${err.message}`
        });
      }
    }

    if (!app.config.devices || !Object.keys(app.config.devices).length)
    {
      return this.skip({
        code: 'ERR_INVALID_CONFIG',
        message: `No devices in the config JSON.`
      });
    }
  },
  function()
  {
    if (!app.config.ftp || app.config.ftp.enabled === false)
    {
      app.config.ftp = null;

      return log('Skipping FTP setup...');
    }

    log('Setting up the FTP directory...');

    app.config.ftp.root = (app.config.ftp.root || '{root}/ftp').replace('{root}', app.root);

    try
    {
      rmdir(app.config.ftp.root);
    }
    catch (err)
    {
      return this.skip({
        code: 'ERR_FTP_SETUP',
        message: `Failed to clear the FTP directory: ${app.config.ftp.root}: ${err.message}`
      });
    }
  },
  function()
  {
    log(`Running ${app.input.steps.length} steps...`);

    const steps = [];

    app.input.steps.forEach((stepConfig, i) =>
    {
      createStepHandler(steps, stepConfig, i + 1);
    });

    steps.push(this.next());

    step(steps);
  },
  function(err)
  {
    if (err)
    {
      log(err.message);
    }

    log('Bye, bye!');

    const result = {};

    if (err)
    {
      Object.assign(result, {
        result: 'failure',
        error: err.code
      });
    }
    else
    {
      Object.assign(result, {
        result: 'success',
        judgement: app.stepResults.every(step => step.result),
        steps: app.stepResults
      });
    }

    console.log(JSON.stringify(result));
    process.exit(err ? 1 : 0); // eslint-disable-line no-process-exit
  }
);

function log(message)
{
  console.error(`${new Date().toISOString()} ${message}`);
}

function createStepHandler(steps, stepConfig, stepNo)
{
  const availableDevices = Object.keys(app.config.devices);

  if (!stepConfig.device && availableDevices.length === 1)
  {
    stepConfig.device = availableDevices[0];
  }

  const device = app.config.devices[stepConfig.device];

  steps.push(function(err)
  {
    if (err)
    {
      return this.skip(err);
    }

    log(`Step ${stepNo}...`);

    if (!device)
    {
      return this.skip({
        code: 'ERR_UNKNOWN_DEVICE',
        message: `Unknown device: ${stepConfig.device}`
      });
    }

    stepConfig.startedAt = Date.now();

    if (!devices[device.type])
    {
      return this.skip({
        code: 'ERR_UNSUPPORTED_DEVICE',
        message: `Unsupported device: ${device.type}`
      });
    }

    devices[device.type](app, {stepNo, stepConfig, device}, this.next());
  });
}

function rmdir(parentPath)
{
  fs.readdirSync(parentPath, {withFileTypes: true}).forEach(dirent =>
  {
    const childPath = path.join(parentPath, dirent.name);

    if (dirent.isDirectory())
    {
      rmdir(childPath);
    }
    else
    {
      fs.unlinkSync(childPath);
    }
  });
}
