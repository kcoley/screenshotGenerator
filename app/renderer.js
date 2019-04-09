"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const BABYLON = require("babylonjs");
require("babylonjs-loaders");
const babylonjs_1 = require("babylonjs");
const { remote } = require('electron');
const { dialog } = remote;
const w = remote.getCurrentWindow();
const fs = require('fs');
const readline = require('readline');
const stream = require('stream');
const con = remote.getGlobal('console');
const { app } = remote;
const { ipcRenderer } = require('electron');
const path = require('path');
const child_process = require("child_process");
const ffmpegPath = require('ffmpeg-binaries');
;
class Renderer {
    createSceneAsync(canvas, engine, filepath, camPos) {
        const self = this;
        return new Promise((resolve, reject) => {
            if (self._scene) {
                self._scene.dispose();
            }
            self._canvas = canvas;
            self._engine = engine;
            // This creates a basic Babylon Scene object (non-mesh)
            const scene = new BABYLON.Scene(engine);
            scene.createDefaultCameraOrLight(true, true, true);
            const arcRotateCamera = scene.activeCamera;
            arcRotateCamera.setPosition(camPos);
            self._camera = arcRotateCamera;
            var hdrTexture = BABYLON.CubeTexture.CreateFromPrefilteredData("assets/environment.dds", scene);
            hdrTexture.gammaSpace = false;
            scene.createDefaultSkybox(hdrTexture, true, 100, 0.0);
            self._scene = scene;
            // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
            const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
            if (filepath) {
                const fileURL = filepath.replace(/\\/g, '/');
                const rootDirectory = BABYLON.Tools.GetFolderPath(fileURL);
                const sceneFileName = BABYLON.Tools.GetFilename(fileURL);
                const self = this;
                if (fs.existsSync(filepath)) {
                    BABYLON.SceneLoader.ImportMesh("", rootDirectory, sceneFileName, self._scene, function (meshes) {
                        let root = new BABYLON.Mesh("root", self._scene);
                        for (const mesh of meshes) {
                            if (!mesh.parent) {
                                mesh.parent = root;
                            }
                        }
                        root.position = new BABYLON.Vector3(0, 0, 0);
                        root.rotation = new BABYLON.Vector3(0, 0, 0);
                        resolve("createSceneAsync: Loaded model: " + fileURL);
                    }, null, function (scene, message, exception) {
                        reject("createSceneAsync: Failed to load model: " + message);
                    });
                }
                else {
                    reject("createSceneAsync: File not found: " + filepath);
                }
            }
            else {
                reject("createSceneAsync: No filepath provided!");
            }
        });
    }
    createSnapshotAsync(canvas, engine, sampleImageName, outputFolder, ms = 30000) {
        const self = this;
        return new Promise((resolve, reject) => {
            const name = BABYLON.Tools.GetFilename(sampleImageName).replace('Figures/SampleImages/', '');
            con.log("making snapshot for: " + name);
            const recorder = new babylonjs_1.VideoRecorder(engine);
            self._scene.executeWhenReady(() => {
                if (sampleImageName.endsWith('.png')) {
                    self._scene.render();
                    self.createScreenshot({ width: self._canvas.width, height: self._canvas.height }, function (base64Image) {
                        if (base64Image) {
                            base64Image = base64Image.replace(/^data:image\/png;base64,/, "");
                            const sampleImageName = outputFolder + '/' + name;
                            fs.writeFile(sampleImageName, base64Image, 'base64', function (err) {
                                if (err) {
                                    reject("error happened: " + err);
                                }
                                else {
                                    resolve("snapshot generated");
                                }
                            });
                        }
                        else {
                            reject("No image data available");
                        }
                    });
                }
                else if (sampleImageName.endsWith('.gif')) {
                    self._scene.getEngine().runRenderLoop(() => {
                        self._scene.render();
                    });
                    // Capture and download a webm of the animated model.
                    const gifFullName = outputFolder + '/' + name;
                    const webmFilename = gifFullName.replace('.gif', '.webm');
                    recorder.startRecording(null, 3).then((videoblob) => {
                        const fileReader = new FileReader();
                        fileReader.onload = function () {
                            fs.writeFileSync(webmFilename, Buffer.from(new Uint8Array(this.result)));
                            // Convert the webm to full-sized animated gif, then a thumbnail.
                            runProgram(`${ffmpegPath} -i ${webmFilename} ${gifFullName} -hide_banner`, __dirname);
                            runProgram(`${ffmpegPath} -i ${webmFilename} -vf scale=72:72 ${gifFullName.replace('SampleImages', 'Thumbnails')} -hide_banner`, __dirname);
                            resolve("Animated gif generated");
                        };
                        fileReader.readAsArrayBuffer(videoblob);
                    });
                }
            });
            //setTimeout(() => {
            //    reject(`createSnapshotAsync: Promise timed out after ${ms} ms.`);
            //}, ms);
        });
    }
    createSnapshotsAsync(glTFAssets, canvas, engine, outputDirectory) {
        return __awaiter(this, void 0, void 0, function* () {
            let snapshotPromiseChain = null;
            for (let i = 0; i < glTFAssets.length; ++i) {
                try {
                    const r = yield this.createSceneAsync(canvas, engine, glTFAssets[i].filepath, glTFAssets[i].camera.translation);
                    const result = yield this.createSnapshotAsync(canvas, engine, glTFAssets[i].sampleImageName, outputDirectory);
                }
                catch (err) {
                    con.log("Failed to create snapshot: " + err);
                }
            }
            con.log("Complete!");
            w.close();
        });
    }
    initialize(canvas) {
        let runHeadless = false;
        let gltf;
        runHeadless = ipcRenderer.sendSync('synchronous-message', 'headless');
        gltf = ipcRenderer.sendSync('synchronous-message', 'gltf');
        let manifest = ipcRenderer.sendSync('synchronous-message', 'manifest');
        let outputDirectory = ipcRenderer.sendSync('synchronous-message', 'outputDirectory');
        const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
        let glTFAssets = null;
        if (manifest) {
            glTFAssets = this.loadManifestFile(manifest);
        }
        if (runHeadless) {
            if (!fs.existsSync(outputDirectory)) {
                fs.mkdirSync(outputDirectory);
            }
            this.createSnapshotsAsync(glTFAssets, canvas, engine, outputDirectory);
        }
        else {
            this.createSceneAsync(canvas, engine, null, new BABYLON.Vector3(0, 0, 1.3));
            canvas.addEventListener("keyup", this.onKeyUp.bind(this));
            engine.runRenderLoop(() => {
                this._scene.render();
            });
            window.addEventListener('resize', function () {
                engine.resize();
            });
        }
    }
    convertToURL(filePath) {
        return filePath.replace(/\\/g, '/');
    }
    createGLTFAsset(model, rootDirectory) {
        BABYLON.Tools.Log("Models present");
        const camera = {
            translation: BABYLON.Vector3.FromArray(model.camera.translation),
        };
        const asset = {
            camera: camera,
            filepath: rootDirectory + model.fileName,
            sampleImageName: model.sampleImageName,
            sampleThumbnailName: model.sampleThumbnailName
        };
        return asset;
    }
    /**
     * Get all the gltf assets of a manifest file.
     * @param manifesFile
     */
    loadManifestFile(manifestJSON) {
        const rootDirectory = BABYLON.Tools.GetFolderPath(this.convertToURL(manifestJSON));
        const result = [];
        const content = fs.readFileSync(manifestJSON);
        // open the manifest file
        const jsonData = JSON.parse(content);
        if ('models' in jsonData) {
            BABYLON.Tools.Log("Models present");
            con.log("models present");
            for (const model of jsonData['models']) {
                result.push(this.createGLTFAsset(model, rootDirectory));
            }
        }
        else {
            for (let i = 0; i < jsonData.length; ++i) {
                const jsonObj = jsonData[i];
                const folder = jsonObj.folder;
                for (const model of jsonObj.models) {
                    result.push(this.createGLTFAsset(model, rootDirectory + folder + "/"));
                }
            }
        }
        return result;
    }
    addMeshToScene(filepath) {
        if (fs.existsSync(filepath)) {
            const fileURL = filepath.replace(/\\/g, '/');
            const rootDirectory = BABYLON.Tools.GetFolderPath(fileURL);
            const sceneFileName = BABYLON.Tools.GetFilename(fileURL);
            const self = this;
            const addMeshPromise = new Promise(function (resolve, reject) {
                BABYLON.SceneLoader.ImportMesh("", rootDirectory, sceneFileName, self._scene, function (meshes) {
                    BABYLON.Tools.Log("Loaded Model");
                    resolve("loaded model: " + fileURL);
                }, null, function (scene, message, exception) {
                    reject("Failed to load model: " + message);
                });
            });
            addMeshPromise.then((result) => {
                con.log(result);
            });
            addMeshPromise.catch((error) => {
                con.error("Failed: " + error);
                throw Error("Failed = " + error);
            });
        }
        else {
            con.log("file not found");
            BABYLON.Tools.Error("File not found: " + filepath);
        }
    }
    onKeyUp(event) {
        const self = this;
        if (event.key == 's' || event.key == 'S') {
            BABYLON.Tools.Log(this._canvas.width.toString());
            this.createScreenshot({ width: this._canvas.width, height: this._canvas.height });
        }
        if (event.key == 'l' || event.key == 'L') {
            BABYLON.Tools.Log('Loading file');
            dialog.showOpenDialog({ properties: ['openFile'] }, function (filePaths) {
                if (filePaths && filePaths.length) {
                    self._scene.dispose();
                    self.createSceneAsync(self._canvas, self._engine, filePaths[0], new BABYLON.Vector3(0, 0, 1.3));
                }
            });
        }
    }
    /**
     * Create an image from the WebGL canvas.
     * @param size - dimensions to use for the image.
     */
    createScreenshot(size, callback) {
        BABYLON.Tools.Log('Exporting texture...');
        BABYLON.Tools.CreateScreenshot(this._engine, this._camera, size, callback);
    }
}
exports.default = Renderer;
/**
 * Launches an specified external program.
 * @param cmd Program to run, including command line parameters.
 * @param directory Filepath to execute the program from.
 * @param exitFunc Code to be run on completion. (Exit message, next function, etc...)
 */
function runProgram(cmd, directory) {
    return new Promise((resolve, reject) => {
        const child = child_process.exec(cmd, { cwd: directory });
        child.stdout.on('data', (data) => {
            console.log(data.toString());
        });
        child.stderr.on('data', (data) => {
            console.log(data.toString());
            reject(data);
        });
        child.on('close', () => {
            resolve('Program Closed');
        });
    });
}
const renderer = new Renderer();
let canvas = document.getElementById('render-canvas');
renderer.initialize(canvas);
//# sourceMappingURL=renderer.js.map