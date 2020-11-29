import * as settings from 'electron-settings'
import * as fs from 'fs'
import * as path from 'path'
import * as request from 'request'
import * as unzipper from 'unzipper'

import config from '../config'

/**
 * Extract files to service folder.
 *
 * @param service Service name
 * @param isUpdate Whether it is an update or first installation
 */
export default function download(service: any, isUpdate: boolean = false) {
    return new Promise<void>((resolve, reject) => {
        const servicePath = path.join(config.paths.services, service.name.toLowerCase())

        if (!fs.existsSync(servicePath)) fs.mkdirSync(servicePath)

        request({
            url: service.url.replace(/{version}/g, service.version),
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        .pipe(unzipper.Parse())
        .on('entry', entry => {
            let fileName = entry.path

            // Nginx and MariaDB put their files into a directory
            if (service.name === 'Nginx' || service.name === 'MariaDB') {
                fileName = fileName.substr(fileName.indexOf('/') + 1)
            }

            // Do not overwrite configuration files on update
            if (isUpdate && (service.ignoredFiles && service.ignoredFiles.includes(fileName))) {
                return
            }

            let fileDestPath = path.join(servicePath, fileName)

            if (entry.type === 'Directory') {
                if (!fs.existsSync(fileDestPath)) {
                    fs.mkdirSync(fileDestPath)
                }

                entry.autodrain()
            } else {
                entry.pipe(fs.createWriteStream(fileDestPath))
            }
        })
        .on('finish', () => {
            settings.set(service.name.toLowerCase(), service.version)
            resolve()
        })
        .on('error', reject)
    })
}