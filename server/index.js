//nodejs服务器
const express = require('express');
const Vue = require('vue');
const path = require('path');
const resolve = file => path.resolve(__dirname, file);

const app = express();
const fs = require('fs');
//用vue实例换一个html的内容
const { createBundleRenderer } = require('vue-server-renderer');
let pageUrl = path.join(__dirname, '../public/index-temp.html')
//是否进行热更新
let argvs = process.argv.toString();
let isHotUpdate = false;
if (argvs.indexOf('IS_HOTUPDATE=1') >= 0)
    isHotUpdate = true;
let dev_method = './hot-update-method1';
if (argvs.indexOf('DEV_METHOD=2') >= 0)
    dev_method = './hot-update-method2';
//热更新时，是否保存bundle,等静态文件到硬盘;
let isSave2Disk = false;
if (argvs.indexOf('IS_SAVE2DISK=1') >= 0)
    isSave2Disk = true;

let renderer = null;
if (!isHotUpdate) {
    //如果不是热更新，打开这些代码
    const serverBundle = require('../dist/server/vue-ssr-server-bundle.json');
    const clientManifest = require('../dist/client/vue-ssr-client-manifest.json');
    renderer = createBundleRenderer(serverBundle, {
        //可选
        runInNewContext: false,
        //宿主模板，生成 到哪自己写一下
        //下面的必选
        template: fs.readFileSync(pageUrl, 'utf-8'),
        clientManifest
    });
}

//是热更新
if (isHotUpdate) {
    const templatePath = resolve('../public/index-temp.html');
    // let readyPromise = require('./hot-update-method1')(
    let readyPromise = require(dev_method)(
        isSave2Disk,
        app,
        templatePath,
        (serverBundle_, options) => {
            //   renderer = createRenderer(bundle, options)
            let tmp = options.clientManifest;
            renderer = createBundleRenderer(serverBundle_, {
                //可选
                runInNewContext: false,
                //宿主模板，生成 到哪自己写一下
                //下面的必选
                template: fs.readFileSync(pageUrl, 'utf-8'),
                tmp
            });
        }
    );
}

// const page = new Vue({
// template:'<div>hello word</div>'
// })

//中间件处理静态文件请求
//关掉index的话，才能避免ssr加载的时候不会出现只加载了一个index的空壳，yaoming
app.use(express.static('./dist/client', { index: false }))
//路由处理交给vue
app.get('*', async (req, res) => {
    try {
        if (!renderer) {
            res.status(304).send('请等待！');
            return;
        }
        const context = {
            url: req.url,
            //标题
            title: 'ssr test'
        }
        const html = await renderer.renderToString(context);
        console.log('-------------> listen:3000, url:', req.url);
        // console.log(html);
        res.send(html);
    } catch (error) {
        res.status(500).send('服务器内部错误')
    }
});

app.listen(3000, () => {
    console.log('渲染服务启动成功 port 3000');
})