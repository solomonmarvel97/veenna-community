'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { app, protocol, net } = require('electron');

/** The app's own origin: the packaged window loads `veenna-community://app/`. */
const SCHEME = 'veenna-community';

function registerPrivilegedScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

function getRendererDistPath() {
  const packagedDistPath = path.join(process.resourcesPath, 'dist');
  const localDistPath = path.join(__dirname, '../../dist');
  return app.isPackaged && fs.existsSync(path.join(packagedDistPath, 'index.html'))
    ? packagedDistPath
    : localDistPath;
}

/** Serves the built UI from disk. Nothing is forwarded anywhere: this handler never touches the network. */
function setupAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const distPath = getRendererDistPath();
    const filePath = path.normalize(path.join(distPath, requestedPath));
    if (!filePath.startsWith(distPath + path.sep) && filePath !== distPath) {
      return new Response('Not found', { status: 404 });
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return net.fetch(pathToFileURL(filePath).toString());
    }

    // Client-side routes (no file extension) fall back to the app shell.
    if (!path.extname(requestedPath)) {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) return net.fetch(pathToFileURL(indexPath).toString());
    }

    return new Response('Not found', { status: 404 });
  });
}

module.exports = { SCHEME, registerPrivilegedScheme, setupAppProtocol, getRendererDistPath };
