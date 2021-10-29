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
    process = new Process('nginx.exe', [], {
        cwd: path.join(config.paths.services, 'nginx')
    })

    return process.run()
}

/**
 * Stop the service.
 */
export function stop(): Promise<void> {
    return process?.kill()
}
