// const fs = require('fs');
const fs = require('fs-extra');
const path = require('path');
const MFS = require('memory-fs');
const webpack = require('webpack');
const chokidar = require('chokidar');
const clientConfig = require('./util').getClientWebpackConfig();
const serverConfig = require('./util').getServerWebpackConfig()


const readFile = (fs, file) => {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch (e) { console.log('------------> readfile error:', e); }
  return '{}';
};

module.exports = function setupDevServer(isSave2Disk, app, templatePath, cb) {
  let bundle;
  let template;
  let clientManifest;

  let ready;
  let ok = false;
  let clientFs;
  const readyPromise = new Promise(r => { ready = r });
  const update = () => {
    if (bundle && clientManifest) {
      ready();
      cb(bundle, {
        template,
        clientManifest,
        inject: false,
        shouldPreload: (file, type) => {
          if (type === 'script' || type === "css") {
            console.log('-----------------> shouldPreload.file:', file);
            return true
          }
        }
      })
    }
  };


  const setupDevServer_sub = () => {
    return new Promise((resolve, reject) => {
      ok = false;
      const serverFs = new MFS()
      serverConfig.cache =false;
      const serverCompile = webpack(serverConfig)
      const clientFs = new MFS()
      const clientCompile = webpack(clientConfig)
      clientConfig.cache=false;
      if (isSave2Disk) {
        //fs-extra 库缺少join 函数，给它加上一个，见：https://github.com/streamich/memfs/issues/323
        fs.join = path.join;
        serverCompile.outputFileSystem = fs;//直接用本地文件系统，而不是保存到内存，
        //便于cmswing更新最新静态文件
        clientCompile.outputFileSystem = fs;
      } else {
        serverCompile.outputFileSystem = serverFs;
        clientCompile.outputFileSystem = clientFs;
      }

      // read template from disk and watch
      template = fs.readFileSync(templatePath, 'utf-8');
      chokidar.watch(templatePath).on('change', () => {
        template = fs.readFileSync(templatePath, 'utf-8');
        console.log('------> index.html template updated.');
        update();
      });

      serverCompile.watch({}, (err, stats) => {
        if (err) {
          throw err
        }
        stats = stats.toJson()
        stats.errors.forEach(error => console.error(error))
        stats.warnings.forEach(warn => console.warn(warn))

        const bundlePath = path.join(
          serverConfig.output.path,
          'vue-ssr-server-bundle.json'
        );
        bundle = JSON.parse(readFile(serverCompile.outputFileSystem, bundlePath))
        update()
      })
      clientCompile.run()
      clientCompile.hooks.done.tap('VueClientPluginDone', (stats) => {
        stats = stats.toJson()
        stats.errors.forEach(err => console.error(err))
        stats.warnings.forEach(err => console.warn(err))
        try {
          const clientManifestPath = path.join(
            clientConfig.output.path,
            'vue-ssr-client-manifest.json'
          );
          // console.log('-----------> path server:',clientManifestPath);
          clientManifest = JSON.parse(readFile(clientCompile.outputFileSystem, clientManifestPath))
          resolve(clientFs)
        } catch (err) {
          console.log('------------> clientCompile.err', err);
        }
        update()
      })
    })
  };

  setupDevServer_sub().then((middleware) => {
    ok = true
    clientFs = middleware;
  })

  return readyPromise
};
