import path from 'path'

import config from '../config'
import Process from '../utils/process'

/**
 * The process instance of the service.
 */
export let process: Process

/**
 * Start the service.
 */
export function start(): Promise<void> {
  process = new Process('PHP', 'php-cgi.exe', ['-b', '127.0.0.1:9000'], {
    cwd: path.join(config.paths.services, 'php')
  })

  return process.run(true)
}

/**
 * Stop the service.
 */
export function stop(): Promise<void> {
  return process?.kill()
}
