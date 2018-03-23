This tools is used with the [glTF-Asset-Generator](https://github.com/bghgary/glTF-Asset-Generator) to generate screenshots.

How to build:
Run these commands:

```
npm install --save babylonjs@3.2.0-beta.1 babylonjs-loaders@3.2.0-beta.1
npm install --save-dev typescript@2.6.2
npm install --save-dev electron@1.7.10
```

To build the generator:

```
npm run build
```

To execute the generator in interactive mode:


**Interactive Mode**
```
npm start
```

Drag or use the arrow keys to reposition the camera

L key - loads a new glTF/glb model
S - takes a screenshot and saves to disk

**Headless Mode**
```
npm start -- headless=true manifest=../path/to/manifest/file outputDirectory=../path/to/save/screenshots
```

