<p align="center">
  <a href="https://electronfriends.org" target="_blank">
    <img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png">
  </a>
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

1. Download and run the latest Wemp installer from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.
2. Choose the installation path (default is `C:\Wemp`).
3. After installation, the services will be downloaded and started automatically.
4. Access your web server at http://localhost or manage your database at http://localhost/phpmyadmin.

## FAQs

### Will uninstalling Wemp delete the services?

No, the services are installed separately from Wemp and remain in place when Wemp is uninstalled.

### Can I use specific service versions?

Support for specific PHP versions is planned for a future release. Currently, there are no plans for version selection of other services.

## Development

Want to contribute? Here's how to set up the development environment:

1. Clone the repository:
   ```bash
   git clone https://github.com/electronfriends/wemp.git
   cd wemp
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start the development environment:
   ```bash
   yarn start
   ```

4. To build the installer:
   ```bash
   yarn make
   ```

## Thanks to

- [Icons8](https://icons8.com) for providing the icons used in our application.

## Contributing

Contribute to Wemp's development by fixing bugs or introducing new features. Feel free to [create an issue](https://github.com/electronfriends/wemp/issues/new) or make a pull request.

We appreciate your support!

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
