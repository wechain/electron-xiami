const { BrowserWindow } = require('electron');
const urlLib = require('url');
const path = require('path');
const fetch = require('electron-fetch');
const storage = require('electron-json-storage');
const notifier = require('node-notifier');

const playerUrl = 'http://www.xiami.com/play';
const playlistUrl = 'http://www.xiami.com/song/playlist';
const getSongUrl = 'http://www.xiami.com/song/gethqsong';

class XiamiPlayer {
    constructor() {
        this.init();
    }

    init() {
        this.playerWindow = new BrowserWindow({
            height: 768,
            width: 1024,
            resizable: true,
            frame: true,
            autoHideMenuBar: true,
            webPreferences: {
                javascript: true,
                plugins: true,
                webSecurity: false,
                nodeIntegration: false
            }
        });

        // load xiami player page.
        this.playerWindow.loadURL(playerUrl);

        // triggering when user try to close the play window.
        this.playerWindow.on('close', (e) => {
            if (this.playerWindow.isVisible()) {
                e.preventDefault();
                this.playerWindow.hide();
            }
        });

        // triggering after the play window closed.
        this.playerWindow.on('closed', () => {
            this.playerWindow = null;
        });

        // intercept the ajax call response
        this.playerWindow.webContents.on('did-get-response-details', ((event, status, newURL, originalURL) => this.registerResponseFilters(originalURL)));
    }

    // display and focus the player window.
    show() {
        this.playerWindow.show();
        this.playerWindow.focus();
    }

    // hide the play window.
    hide() {
        this.playerWindow.hide();
    }

    // return a boolean to indicate if the window is visible or not
    isVisible() {
        return this.playerWindow.isVisible();
    }

    pause() {
        this.playerWindow.webContents.executeJavaScript("document.querySelector('.pause-btn').dispatchEvent(new MouseEvent('click'));");
    }

    play() {
        this.playerWindow.webContents.executeJavaScript("document.querySelector('.play-btn').dispatchEvent(new MouseEvent('click'));");
    }

    next() {
        this.playerWindow.webContents.executeJavaScript("document.querySelector('.next-btn').dispatchEvent(new MouseEvent('click'));");
    }

    previous() {
        this.playerWindow.webContents.executeJavaScript("document.querySelector('.prev-btn').dispatchEvent(new MouseEvent('click'));");
    }

    getWebContents() {
        return this.playerWindow.webContents;
    }

    registerResponseFilters(requestUrl) {
        this.updatePlaylistListener(requestUrl);
        this.changeTrackListener(requestUrl);
    }

    updatePlaylistListener(requestUrl) {
        if (requestUrl.startsWith(playlistUrl)) {
            let urlWithPath = urlLib.parse(requestUrl, false);
            delete urlWithPath.search;
            // console.log('Retrieve the playlist from url ' + urlLib.format(urlWithPath));

            // get the cookie, make call with the cookie
            let session = this.playerWindow.webContents.session;
            session.cookies.get({ url : 'http://www.xiami.com' }, (error, cookies) => {
                let cookieString =cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join(';');
                fetch(urlLib.format(urlWithPath), {headers: {'Cookie': cookieString}}).then(res => res.json()).then(json => {

                    // refresh the local storage.
                    json.data.trackList.forEach(track => {
                        // console.log(track.songName);
                        storage.set(track.songId, track, (error) => {
                            if (error) console.log(error);
                        });
                    });
                }).catch((error) => {
                    console.log(error);
                });
            });
        }
    }

    changeTrackListener(requestUrl) {
        if (requestUrl.startsWith(getSongUrl)) {
            let pathname = urlLib.parse(requestUrl).pathname;
            let songId = path.parse(pathname).base;

            storage.get(songId, (error, trackInfo) => {
                if (error) throw error;
                // console.log(trackInfo);
                if (Object.keys(trackInfo).length > 0) {
                    notifier.notify({
                        'icon': path.join(__dirname, '../../../assets/icon.png'),
                        'title': `Track: ${trackInfo.songName}`,
                        'message': `Artist: ${trackInfo.artist_name}
Album: ${trackInfo.album_name}`
                    });
                }
            });
        }
    }
}

module.exports = XiamiPlayer;