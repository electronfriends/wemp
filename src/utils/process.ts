import { ChildProcess, exec, spawn } from 'child_process'
import type { SpawnOptionsWithoutStdio } from 'child_process'

import { updateMenuStatus } from '../main-process/menu'
import * as logger from '../utils/logger'
import { onServiceError } from './notification'

export default class Process {
  private readonly name: string
  private readonly command: string
  private readonly args: string[]
  private readonly options?: SpawnOptionsWithoutStdio
  private child?: ChildProcess

  /**
   * @constructor
   *
   * @param name - The service name
   * @param command - The command to run
   * @param args - The arguments
   * @param options - The options
   */
  constructor(name: string, command: string, args: string[], options?: SpawnOptionsWithoutStdio) {
    this.name = name
    this.command = command
    this.args = args
    this.options = options
  }

  /**
   * Check if the child process is already running.
   */
  isRunning(): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      exec('tasklist', (error, stdout) => {
        if (error) {
          return reject(error)
        }

        resolve(stdout.indexOf(this.command) > -1)
      })
    })
  }

  /**
   * Kill the child process.
   */
  async kill(): Promise<void> {
    if (!this.child) {
      return
    }

    // Let the child process know that it was intentionally killed
    this.child.kill()

    await new Promise<void>((resolve) => {
      exec(`taskkill /IM "${this.command}" /F`, () => resolve())
    })
  }

  /**
   * Run the child process.
   *
   * @param restartOnClose - Whether the process should be restarted if it closes unexpectedly
   */
  async run(restartOnClose = false): Promise<void> {
    const isRunning = await this.isRunning()

    if (isRunning) {
      await this.kill()
    }

    await new Promise<void>((resolve, reject) => {
      this.child = spawn(this.command, this.args, this.options)

      this.child.stderr?.on('data', (data) => {
        logger.write(`[${this.name}] ${data}`)
      })

      this.child.on('close', () => {
        // The process was closed on purpose
        if (this.child.killed) {
          return
        }

        // The process should be restarted when closing unexpectedly
        if (restartOnClose) {
          this.run(true)
          return
        }

        updateMenuStatus(this.name, false)
        onServiceError(this.name)
      })

      this.child.on('error', (error) => {
        reject(error)
      })

      this.child.on('spawn', () => {
        resolve()
      })
    })
  }
}
