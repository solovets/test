import express from 'express';
import { join, resolve, basename } from 'path';
import { videosMetadata } from './mocks.js';
import normalizePath from 'normalize-path';
import livereload from 'livereload';
import connectLiveReload from 'connect-livereload';

const liveReloadServer = livereload.createServer();
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});
const app = express();
const __dirname = import.meta.dirname;
const videoPath = join(resolve(__dirname), '/public/videos/');
const videoExt = '.MP4';

app.use(connectLiveReload());

app.get('/', (req, res) => {
  res.sendFile(join(resolve(__dirname), 'index.html'));
});

const getFeed = (req, res, next) => {

    let videoData = [];

    videosMetadata.forEach(video => {

        let fileBaseName, id;

        if (
            typeof video === 'object' &&
            Array.isArray(video) === false &&
            video !== null &&
            video.hasOwnProperty('fileName') &&
            typeof video.fileName === 'string'
        ) {
            fileBaseName = basename(video.fileName, videoExt);
            id = Math.random().toString(10).substring(2, 10) + fileBaseName;
        }

        if (typeof id === 'string') {
            let _video = Object.assign({}, video);
            delete _video.fileName;
            _video.url = normalizePath(join('/v/', id));
            videoData.push(_video);
        }

    });

    

    res.locals.feed = videoData;
    next();
};

app.get('/feed', getFeed, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const result = res.locals.feed.slice((page - 1) * 10, page * 10);
    res.send(result);
});

app.get('/v/:filemask', (req, res) => {
    const fileName = req.params.filemask.substring(8) + videoExt;
    const file = join(videoPath, fileName);
    res.sendFile(file);
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000')
})