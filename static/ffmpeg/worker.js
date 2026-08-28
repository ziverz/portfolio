// Pinned browser worker for @ffmpeg/ffmpeg 0.12.10.
import { CORE_URL, FFMessageType } from './const.js';
import {
    ERROR_UNKNOWN_MESSAGE_TYPE,
    ERROR_NOT_LOADED,
    ERROR_IMPORT_FAILURE
} from './errors.js';

let ffmpeg;

const load = async ({ coreURL: requestedCoreURL, wasmURL: requestedWasmURL, workerURL: requestedWorkerURL }) => {
    const firstLoad = !ffmpeg;
    let coreURL = requestedCoreURL || CORE_URL;

    try {
        importScripts(coreURL);
    } catch {
        if (!requestedCoreURL) coreURL = CORE_URL.replace('/umd/', '/esm/');
        self.createFFmpegCore = (await import(coreURL)).default;
        if (!self.createFFmpegCore) throw ERROR_IMPORT_FAILURE;
    }

    const wasmURL = requestedWasmURL || coreURL.replace(/.js$/g, '.wasm');
    const workerURL = requestedWorkerURL || coreURL.replace(/.js$/g, '.worker.js');

    ffmpeg = await self.createFFmpegCore({
        mainScriptUrlOrBlob: `${coreURL}#${btoa(JSON.stringify({ wasmURL, workerURL }))}`
    });
    ffmpeg.setLogger((data) => self.postMessage({ type: FFMessageType.LOG, data }));
    ffmpeg.setProgress((data) => self.postMessage({ type: FFMessageType.PROGRESS, data }));
    return firstLoad;
};

const exec = ({ args, timeout = -1 }) => {
    ffmpeg.setTimeout(timeout);
    ffmpeg.exec(...args);
    const result = ffmpeg.ret;
    ffmpeg.reset();
    return result;
};

const handlers = {
    [FFMessageType.LOAD]: load,
    [FFMessageType.EXEC]: exec,
    [FFMessageType.WRITE_FILE]: ({ path, data }) => {
        ffmpeg.FS.writeFile(path, data);
        return true;
    },
    [FFMessageType.READ_FILE]: ({ path, encoding }) => ffmpeg.FS.readFile(path, { encoding }),
    [FFMessageType.DELETE_FILE]: ({ path }) => {
        ffmpeg.FS.unlink(path);
        return true;
    },
    [FFMessageType.RENAME]: ({ oldPath, newPath }) => {
        ffmpeg.FS.rename(oldPath, newPath);
        return true;
    },
    [FFMessageType.CREATE_DIR]: ({ path }) => {
        ffmpeg.FS.mkdir(path);
        return true;
    },
    [FFMessageType.LIST_DIR]: ({ path }) => ffmpeg.FS.readdir(path).map((name) => {
        const stat = ffmpeg.FS.stat(`${path}/${name}`);
        return { name, isDir: ffmpeg.FS.isDir(stat.mode) };
    }),
    [FFMessageType.DELETE_DIR]: ({ path }) => {
        ffmpeg.FS.rmdir(path);
        return true;
    },
    [FFMessageType.MOUNT]: ({ fsType, options, mountPoint }) => {
        const fileSystem = ffmpeg.FS.filesystems[fsType];
        if (!fileSystem) return false;
        ffmpeg.FS.mount(fileSystem, options, mountPoint);
        return true;
    },
    [FFMessageType.UNMOUNT]: ({ mountPoint }) => {
        ffmpeg.FS.unmount(mountPoint);
        return true;
    }
};

self.onmessage = async ({ data: { id, type, data: messageData } }) => {
    const transferable = [];

    try {
        if (type !== FFMessageType.LOAD && !ffmpeg) throw ERROR_NOT_LOADED;
        const handler = handlers[type];
        if (!handler) throw ERROR_UNKNOWN_MESSAGE_TYPE;

        const data = await handler(messageData);
        if (data instanceof Uint8Array) transferable.push(data.buffer);
        self.postMessage({ id, type, data }, transferable);
    } catch (error) {
        self.postMessage({ id, type: FFMessageType.ERROR, data: error.toString() });
    }
};
