import { ipcRenderer } from 'electron'

window.addEventListener('DOMContentLoaded', () => {
    // Update Loading Texts
    const title = document.getElementById('title')
    const subtitle = document.getElementById('subtitle')

    ipcRenderer.on('update-titles', (event, args) => {
        title.innerHTML = args.title
        subtitle.innerHTML = args.subtitle
    })

    // Countdown
    const info = document.getElementById('bottom-info')
    let countdownTicks = 15

    ipcRenderer.on('start-countdown', () => {
        info.innerHTML = `This window will close in <span id="countdown">${countdownTicks} seconds</span>.`
    
        const countdown = document.getElementById('countdown')
        const timer = setInterval(() => {
            if (countdownTicks === 0) {
                clearInterval(timer)
                ipcRenderer.send('countdown-complete')
            }

            countdown.innerHTML = `${countdownTicks} ${countdownTicks > 1 ? 'seconds' : 'second'}`
            countdownTicks--
        }, 1000)
    })
})