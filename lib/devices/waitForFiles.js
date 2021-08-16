// Part of <https://miracle.systems/p/walkner-ipt-vision> licensed under <CC BY-NC-SA 4.0>

'use strict';

const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const _ = require('lodash');
const sharp = require('sharp');
const step = require('h5.step');

module.exports = (app, stepConfig, stepResult, done, startedAt) =>
{
  let uploadedFiles = [];

  if (typeof stepResult.image === 'string' && /\.(bmp|jpg)$/i.test(stepResult.image))
  {
    uploadedFiles.push(stepResult.image);
  }

  stepResult.image = null;

  if (!app.config.ftp && !uploadedFiles.length)
  {
    return done();
  }

  const now = Date.now();

  if (!startedAt)
  {
    if (!uploadedFiles.length)
    {
      app.log('Waiting for image files...');
    }

    startedAt = now;
  }

  if (!uploadedFiles.length)
  {
    uploadedFiles = fs.readdirSync(app.config.ftp.root).map(file =>
    {
      const filePath = path.join(app.config.ftp.root, file);

      return {
        path: filePath,
        time: fs.statSync(filePath).mtimeMs
      };
    });
  }
  else
  {
    uploadedFiles = uploadedFiles.map(path =>
    {
      return {
        path,
        time: fs.statSync(path).mtimeMs
      };
    });
  }

  uploadedFiles = uploadedFiles
    .filter(file => file.time > stepConfig.startedAt)
    .sort((a, b) => b.time - a.time);

  const waitForFilesMs = (app.config.ftp && app.config.ftp.waitForFiles || 10000) + 100;

  if (!uploadedFiles.length && now - startedAt >= waitForFilesMs)
  {
    app.log('...waiting for image files expired.');

    return done();
  }

  if (!uploadedFiles.length
    || now - uploadedFiles[0].time < 1000)
  {
    return setTimeout(module.exports, 100, app, stepConfig, stepResult, done, startedAt);
  }

  if (uploadedFiles.length > 1)
  {
    app.log(`Found ${uploadedFiles.length} files.`);
  }

  const imagePath = uploadedFiles[0].path;
  const overlayPath = imagePath.replace(/\.(bmp|jpg)$/i, '.svg');

  app.log(`Using the latest file: ${imagePath}`);

  step(
    function()
    {
      app.log('Converting the image WEBP...');

      const next = _.once(this.next());
      const command = path.join(app.root, 'bin', 'cwebp.exe');
      const args = [
        '-quiet',
        imagePath,
        '-o', '-'
      ];
      const p = childProcess.spawn(command, args);
      const buffers = [];

      p.stdout.on('data', data =>
      {
        buffers.push(data);
      });
      p.stderr.on('data', data =>
      {
        buffers.push(data);
      });

      p.on('error', err => next(err));

      p.on('close', () =>
      {
        if (!buffers.length)
        {
          return next({message: 'No image data.'});
        }

        stepResult.image = Buffer.concat(buffers);

        next();
      });
    },
    function(err)
    {
      if (err)
      {
        return this.skip({
          code: 'ERR_IMAGE_CONVERT',
          message: `Failed to convert the image to WEBP: ${err.message}`
        });
      }

      if (fs.existsSync(overlayPath))
      {
        app.log('Overlaying the graphics on the image...');

        sharp(stepResult.image)
          .composite([{input: overlayPath}])
          .toFormat('webp')
          .toBuffer(this.next());
      }
    },
    function(err, image)
    {
      if (err)
      {
        return this.skip({
          code: 'ERR_IMAGE_OVERLAY',
          message: `Failed to overlay graphics on image: ${err.message}`
        });
      }

      if (image)
      {
        stepResult.image = image;
      }

      if (typeof app.config.writeLastImage === 'string')
      {
        app.log('Saving the last image...');

        fs.writeFile(
          app.config.writeLastImage.replace('{root}', app.root),
          stepResult.image,
          this.next()
        );
      }
    },
    function(err)
    {
      if (err)
      {
        return this.skip({
          code: 'ERR_IMAGE_SAVE',
          message: `Failed to save the last WEBP: ${err.message}`
        });
      }
    },
    function(err)
    {
      if (err)
      {
        stepResult.image = null;

        return done(err);
      }

      stepResult.image = app.config.writeLastImage
        ? undefined
        : stepResult.image.toString('base64');

      done();
    }
  );
};
