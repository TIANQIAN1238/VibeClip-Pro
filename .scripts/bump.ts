// @ts-nocheck
/* eslint-disable */
// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import fs from 'fs';
import semver from 'semver';
import packageJson from '../package.json';

const availableTypes = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'] as const;
type UpdateType = typeof availableTypes[number];

function isFineType(type: string): type is UpdateType {
    return availableTypes.includes(type as UpdateType);
}

let updateType: UpdateType = 'patch';
if (process.argv.length > 2) {
    const type = process.argv[2];
    if (isFineType(type)) {
        updateType = type;
    } else {
        console.error(`Invalid type: ${type}`);
        console.error(`Available types: ${availableTypes.join(', ')}`);
        process.exit(1);
    }
}

const newVersion = semver.inc(packageJson.version, updateType);
console.log('Bump:', packageJson.version, '->', newVersion);

console.log("Updating package.json...");
packageJson.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 4));

console.log("Updating AppInfo.ts...");
const versionTs = fs.readFileSync('src/AppInfo.ts').toString();
const newVersionTs = versionTs.replace(/version: ".*",/, `version: "${newVersion}",`);
fs.writeFileSync('src/AppInfo.ts', newVersionTs);

console.log("Updating Cargo.toml...");
const cargoToml = fs.readFileSync('src-tauri/Cargo.toml').toString();
const newCargoToml = cargoToml.replace(/version = ".*"/, `version = "${newVersion}"`);
fs.writeFileSync('src-tauri/Cargo.toml', newCargoToml);

console.log("Update tauri.conf.json...");
const tauriConf = fs.readFileSync('src-tauri/tauri.conf.json').toString();
const newTauriConf = tauriConf.replace(/"version": ".*"/, `"version": "${newVersion}"`);
fs.writeFileSync('src-tauri/tauri.conf.json', newTauriConf);

console.log("Done!");