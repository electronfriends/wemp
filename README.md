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

Wemp simplifies the process of setting up a web server with [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://www.php.net) on Windows. It downloads these services and keeps them up to date with regular updates.

Manage the services conveniently from the menu by clicking the Wemp icon in the system tray.

<p align="center">
  <img src="https://github.com/electronfriends/wemp/assets/69470382/907195df-53c2-48df-9daa-5a97cd00dbc6" alt="Wemp preview">
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

## FAQs

### Will uninstalling Wemp delete the services?

No, the services are installed separately from Wemp and remain in place when Wemp is uninstalled.

### Why does the autostart option get reset after every update?

This is due to Electron Forge and we have already opened an [issue](https://github.com/electron/forge/issues/3333) about this, but unfortunately there has been no response yet.

### Can I use specific service versions?

Not yet, but it is planned for a future version of Wemp.

## Thanks to

- [Icons8](https://icons8.com) for providing the free Fluency icons used in our menu.

## Contributing

Contribute to Wemp's development by fixing bugs or introducing new features. Feel free to [create an issue](https://github.com/electronfriends/wemp/issues/new) or make a pull request.

We appreciate your support!

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
