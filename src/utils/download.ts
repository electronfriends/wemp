import settings from 'electron-settings'
import fs from 'fs'
import path from 'path'
import request from 'request'
import unzipper from 'unzipper'

import config from '../config'

/**
 * Download and extract service files.
 *
 * @param service Service configuration
 * @param isUpdate Whether it is an update or first download
 */
export default function download(service, isUpdate) {
    return new Promise<void>((resolve, reject) => {
        const serviceName = service.name.toLowerCase()
        const servicePath = path.join(config.paths.services, serviceName)

        if (!fs.existsSync(servicePath)) {
            fs.mkdirSync(servicePath)
        }

        request({
            url: service.url.replace(/{version}/g, service.version),
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
            .pipe(unzipper.Parse())
            .on('entry', entry => {
                let fileName = entry.path

                // We assume that only PHP doesn't put the files inside a directory
                if (service.name !== 'PHP') {
                    fileName = fileName.substr(fileName.indexOf('/') + 1)
                }

                // Skip configuration file and ignored directories
                const isConfig = fileName === service.config
                const isIgnored = isUpdate && (service.ignore && service.ignore.some(v => fileName.includes(v)))

                if (!isConfig && !isIgnored) {
                    let fileDestPath = path.join(servicePath, fileName)

                    if (entry.type === 'Directory') {
                        if (!fs.existsSync(fileDestPath)) {
                            fs.mkdirSync(fileDestPath)
                        }
                    } else {
                        entry.pipe(fs.createWriteStream(fileDestPath))
                    }
                } else {
                    entry.autodrain()
                }
            })
            .on('finish', () => {
                settings.setSync(serviceName, service.version)
                resolve()
            })
            .on('error', reject)
    })
}
