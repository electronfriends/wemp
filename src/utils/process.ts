import { ChildProcess, exec, execFile, ExecFileOptions } from 'child_process'
import { ObjectEncodingOptions } from 'fs'

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
     * @param restartOnExit - Whether the process should be restarted on exit
     */
    async run(restartOnExit: boolean = false): Promise<void> {
        const status = await this.isRunning()

        if (status) {
            await this.kill()
        }

        return new Promise<void>((resolve, reject) => {
            this.child = execFile(this.command, this.args, this.options, (error) => {
                if (error) {
                    // The process was terminated on purpose
                    if (error.killed) {
                        return
                    }

                    // The process has returned an unexpected error
                    return reject(error)
                }

                // The process should be restarted
                if (restartOnExit) {
                    return this.run(true)
                }

                // There is no error, but the process was terminated
                return reject(`The process '${this.command}' was terminated without error message.`)
            })

            resolve()
        })
    }
}
