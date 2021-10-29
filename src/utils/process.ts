import { ChildProcess, exec, execFile, ExecFileOptions } from 'child_process'
import { ObjectEncodingOptions } from 'fs'

import * as logger from '../utils/logger'

export default class Process {
    private child: ChildProcess | null = null
    private command: string
    private args: string[]
    private options: (ObjectEncodingOptions & ExecFileOptions) | null | undefined

    /**
     * @constructor
     * @param command - The command to run
     * @param options - The options
     */
    constructor(command: string, args: string[], options: (ObjectEncodingOptions & ExecFileOptions) | null | undefined) {
        this.command = command
        this.args = args
        this.options = options
    }

    /**
     * Check if the child process is already running.
     */
    isRunning(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            exec('tasklist', (error, stdout, stderr) => {
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
    kill(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Let the child process know that it was intentionally killed
            this.child?.kill()

            exec(`taskkill /IM "${this.command}" /F`, () => {
                resolve()
            })
        })
    }

    /**
     * Run the child process.
     */
    run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const status = await this.isRunning()

            if (status) {
                await this.kill()
            }

            this.child = execFile(this.command, this.args, this.options, (error, stdout, stderr) => {
                if (error && !error.killed) {
                    return reject(error)
                }

                if (stderr) {
                    logger.write(stderr.toString())
                }
            })

            resolve()
        })
    }
}
