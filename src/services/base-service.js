import path from 'path';

import config from '../config';
import Process from '../utils/process';

class BaseService {
  constructor(name, executable, args = [], binPath = '', restartOnClose = false) {
    this.process = null;
    this.name = name;
    this.executable = executable;
    this.args = args;
    this.binPath = binPath || '';
    this.restartOnClose = restartOnClose;
  }

  get cwd() {
    return path.join(config.paths.services, this.name.toLowerCase(), this.binPath);
  }

  async start() {
    this.process = new Process(this.name, this.executable, this.args, { cwd: this.cwd }, this.restartOnClose);

    await this.process.run();
  }

  async stop() {
    await this.process?.kill();
  }
}

export default BaseService;
