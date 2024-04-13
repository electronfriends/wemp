<p align="center">
  <img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png">
</p>

<p align="center">
  <a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg?style=flat-square" alt="Latest Stable Version"></a>
  <a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg?style=flat-square" alt="Total Downloads"></a>
  <a href="https://github.com/electronfriends/wemp/issues"><img src="https://img.shields.io/github/issues/electronfriends/wemp.svg?style=flat-square" alt="GitHub Issues"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg?style=flat-square" alt="License"></a>
</p>

## Introduction

Wemp simplifies the process of setting up a web server with [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://www.php.net) on Windows. It includes these services and keeps them up to date with regular updates.

Manage the services conveniently through the system tray menu by clicking the Wemp icon.

<p align="center">
  <img src="https://github.com/electronfriends/wemp/assets/69470382/ef05b121-1b4d-4a9e-aedd-35961e666d78" alt="Wemp preview">
</p>

## Features

- **User-friendly Interface**: Designed for both beginners and experienced users.
- **Regular Updates**: Ensures you have the latest versions of all services.
- **Database Management**: Utilizes [phpMyAdmin](https://www.phpmyadmin.net) for easy database management.
- **Configuration Monitoring**: Automatically restarts services upon configuration changes.
- **Error Logging**: Tracks errors in a session-based log file for quick debugging.
- **Autostart Option**: Start Wemp automatically at system startup.

## Installation

1. Download and run the latest Wemp setup from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.
2. Choose the installation path (default is `C:\Wemp`).
3. Once downloaded, the services will start automatically.
4. Get started at http://localhost and manage your database at http://localhost/phpmyadmin.

For assistance, [create a new issue](https://github.com/electronfriends/wemp/issues/new) and we'll be happy to help.

## FAQs

### Will uninstalling Wemp delete the services?

No, the services are separate from Wemp and remain intact after uninstalling.

### Why does the autostart option reset after updates?

This is a known issue with Electron Forge, for which we've opened an [issue](https://github.com/electron/forge/issues/3333).

### Can I use specific service versions?

Not yet.

## Thanks to

- [Electron](https://www.electronjs.org) for enabling Windows application development with JavaScript.
- [Icons8](https://icons8.com) for providing the free Fluency icons used in our menu.

## Contributing

Contribute to Wemp's development by fixing bugs or introducing new features. Feel free to [create an issue](https://github.com/electronfriends/wemp/issues/new) or make a pull request.

We appreciate your support!

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
