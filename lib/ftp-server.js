// Part of <https://miracle.systems/p/walkner-ipt-vision> licensed under <CC BY-NC-SA 4.0>

'use strict';

const path = require('path');
const fs = require('fs');
const FtpSrv = require('ftp-srv');
const bunyan = require('bunyan');

const logger = bunyan.createLogger({name: 'ftp-server', level: 'trace'});
const appRoot = path.resolve(__dirname, '..');

logger.info('Reading config.production.json...');

let config = null;

try
{
  config = require(`${appRoot}/config.production.json`);
}
catch (err)
{
  logger.info('Reading config.json...');

  try
  {
    config = require(`${appRoot}/config.json`);
  }
  catch (err)
  {
    logger.error(err, 'Failed to read the config JSON.');

    process.exit(1); // eslint-disable-line no-process-exit
  }
}

if (!config || !config.ftp || config.ftp.enabled === false)
{
  logger.warn('FTP server is disabled.');

  process.exit(1); // eslint-disable-line no-process-exit
}

const ftpRoot = (config.ftp.root || '{root}/ftp').replace('{root}', appRoot);

logger.info('Starting the FTP server...');

try { fs.mkdirSync(ftpRoot, {recursive: true}); }
catch (err) {} // eslint-disable-line no-empty

const ftpServer = new FtpSrv({
  url: config.ftp.url,
  log: logger,
  timeout: 0
});

ftpServer.on('login', (data, resolve, reject) =>
{
  if (data.username === config.ftp.user && data.password === config.ftp.pass)
  {
    resolve({root: ftpRoot});
  }
  else
  {
    reject(new Error('Invalid credentials.'));
  }
});

ftpServer.listen();
