import { SpawnOptions, exec } from 'child_process';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from 'fs';
import { basename, join } from 'path';
import * as util from 'util';

import * as semver from 'semver';
import * as config from './config';

export const execp = util.promisify(exec);

// copy dir to target
export function copyDirectory(source, target) {
  let files = [];

  // check if folder needs to be created or integrated
  const targetFolder = join(target, basename(source));
  if (!existsSync(targetFolder)) {
    mkdirSync(targetFolder);
  }

  // copy
  if (lstatSync(source).isDirectory()) {
    files = readdirSync(source);
    for (let i = 0; i < files.length; i++) {
      const curSource = join(source, files[i]);
      if (lstatSync(curSource).isDirectory()) {
        copyDirectory(curSource, targetFolder);
      } else {
        // async
        copyFile(curSource, join(targetFolder, files[i]));
      }
    }
  }
}

export function copyDirectoryTo(source, target) {
  let files = [];

  if (!existsSync(target)) {
    console.log(target);
    mkdirSync(target);
  }

  // check if folder needs to be created or integrated
  const targetFolder = join(target, basename(source));
  if (!existsSync(targetFolder)) {
    mkdirSync(targetFolder);
  }

  // copy
  if (lstatSync(source).isDirectory()) {
    files = readdirSync(source);
    files.forEach(function (file) {
      const curSource = join(source, file);
      if (lstatSync(curSource).isDirectory()) {
        copyDirectoryTo(curSource, targetFolder);
      } else {
        copyFileTest(curSource, targetFolder);
      }
    });
  }
}

function copyFileTest( source, target ) {

  let targetFile = target;

  // if target is a directory a new file with the same name will be created
  if ( existsSync( target ) ) {
      if ( lstatSync( target ).isDirectory() ) {
          targetFile = join( target, basename( source ) );
      }
  }

  writeFileSync(targetFile, readFileSync(source));
}

export function copyFileSync(source, dest, hook) {
  if (!existsSync(source)) {
    vlog('Cannot copy - File does not exist ', source);
    return false;
  }
  vlog('Copying file syncronously ', source);
  let fileData = readFileSync(source);

  if (typeof hook === 'function') {
    // note, changing fileData from buffer to string
    // writeFileSync accepts both
    fileData = hook(fileData.toString('utf8'));
  }

  // create parent directory if it doesn't exist
  const pathArray = dest.split('/');
  pathArray.pop();
  const parentDirectory = pathArray.join('/');
  // console.log(dest, parentDirectory)
  if (!existsSync(parentDirectory)) {
    mkdirSync(parentDirectory);
  }

  writeFileSync(dest, fileData);
  return true;
}

export function copyFile(source, target) {
  const rd = createReadStream(source);
  const wr = createWriteStream(target);
  return new Promise(function(resolve, reject) {
    rd.on('error', reject);
    wr.on('error', reject);
    wr.on('finish', resolve);
    rd.pipe(wr);
  }).catch(function(error) {
    rd.destroy();
    wr.end();
    throw error;
  });
}

export function filterParentDirectory(path) {
  const pathArray = path.split('/');
  return pathArray[pathArray.length - 2];
}

export async function preCheck() {
  if (!existsSync(config.API_DOCS_DIR)) {
    mkdirSync(config.API_DOCS_DIR);
  }

  return (await validateNPMVersion()) && validateNodeVersion(process.version);
}

// logging function that checks to see if VERBOSE mode is on
export function vlog(message, data = null) {
  if (config.VERBOSE) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

export async function validateNPMVersion() {
  const { stdout: npmVersion } = await execp('npm -v');
  const { major, minor } = semver.parse(npmVersion.trim());

  if (major < 5 || (major === 5 && minor < 8)) {
    throw new Error(
      'Running the CI scripts requires NPM version 5.8 or higher.'
    );
  }
  return true;
}

export function validateNodeVersion(version: string) {
  const { major, minor } = semver.parse(version);

  if (major < 7 || (major === 7 && minor < 6)) {
    throw new Error(
      'Running the CI scripts requires Node version 7.6 or higher.'
    );
  }
  return true;
}

export function listDirs(dir) {
  return readdirSync(dir).filter(x => lstatSync(join(dir, x)).isDirectory());
}

export function deleteFolderRecursive(path) {
  if (!path || path === '/') {
    throw(new Error('Refusing to delete system root'));
  }
  if (existsSync(path)) {
    readdirSync(path).forEach(function(file, index) {
      const curPath = join(path, file);
      if (lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        unlinkSync(curPath);
      }
    });
    rmdirSync(path);
  }
}

/** Apply an intro class to the first set of paragraphs in a markdown file */
export function introify(text, introClass = 'intro') {
  if (!text || text.length === 0) {
    return text;
  }

  const lineArray = text.split('\n');
  let lastLineEmpty = false;

  for (let i = 0; i < lineArray.length; i++) {
    if (
      (i === 0 && lineArray[i].charAt(0) === '#') || // allow for h1's at the start
      lineArray[i].length === 0
    ) {
      lastLineEmpty = true;
      continue;
    }

    // a code sample, table, or heading break out of the loop
    if (
      ['##', '``'].indexOf(lineArray[i].substring(0, 2)) !== -1 ||
      ['|', '>', '<'].indexOf(lineArray[i].charAt(0)) !== -1
    ) {
      break;
    }

    if (lastLineEmpty || i === 0) {
      // starting a new paragraph
      lineArray[i] = `<p class="${introClass}">${lineArray[i]}</p>`;
    } else {
      // if the last line was a heading, move the closing tag down
      lineArray[i - 1] = lineArray[i - 1].replace('</p>', '');
      lineArray[i] = `${lineArray[i]}</p>`;
    }

    lastLineEmpty = false;
  }

  return lineArray.join('\n');
}
