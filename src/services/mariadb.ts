import { exec, execFileSync, spawn } from 'child_process'
import path from 'path'

import config from '../config'
import Process from '../utils/process'

/**
 * The process instance of the service.
 */
export let process: Process

/**
 * The path to the binaries of the service.
 */
const servicePath: string = path.join(config.paths.services, 'mariadb', 'bin')

/**
 * MariaDB needs to be installed before the first start.
 */
export function install(): Promise<void> {
  return new Promise((resolve, reject) => {
    exec('mysql_install_db.exe', { cwd: servicePath }, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

/**
 * Shut down the MariaDB server properly before an update.
 */
export function shutdown(): Promise<void> {
  const maxRetries = 3
  let retryCount = 0

  return new Promise((resolve, reject) => {
    function attemptShutdown() {
      try {
        execFileSync('mysqladmin.exe', ['shutdown', '-u', 'root'], { cwd: servicePath })
        resolve()
      } catch (err) {
        if (retryCount === maxRetries) {
          reject(err)
        } else {
          retryCount++
          setTimeout(attemptShutdown, 3000)
        }
      }
    }

    const childProcess = spawn('mariadbd.exe', ['--skip-grant-tables'], { cwd: servicePath })

    childProcess.on('error', (err) => {
      reject(err)
    })

    childProcess.on('spawn', () => {
      attemptShutdown()
    })
  })
}

/**
 * Run the upgrade tool to check and update the tables after an update.
 */
export function upgrade(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec('mysql_upgrade.exe', { cwd: servicePath }, (error) => {
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
}

/**
 * Start the service.
 */
export function start(): Promise<void> {
  process = new Process('MariaDB', 'mariadbd.exe', [], { cwd: servicePath })

  return process.run()
}

/**
 * Stop the service.
 */
export function stop(): Promise<void> {
  return process?.kill()
}
