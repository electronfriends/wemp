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

## System Requirements

- Windows 10 or later (64-bit)
- Internet connection for downloading services

## Installation

1. Download and run the latest Wemp installer from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.
2. Choose the installation path where the services will be installed (default is `C:\Wemp`).
3. Required services will be downloaded and configured automatically.
4. Access your web server at http://localhost or manage your database at http://localhost/phpmyadmin.

## FAQs

### Will uninstalling Wemp delete the services?

No. Uninstalling Wemp only removes the application itself. All services, configurations, and your web files remain completely intact and in their original location.

### How can I use PHP, MariaDB, and Nginx from the command line?

To use these services from the command line, you'll need to add their paths to your user's PATH environment variable:

- PHP: `C:\Wemp\php`
- MariaDB: `C:\Wemp\mariadb\bin`
- Nginx: `C:\Wemp\nginx`

Note: If you installed Wemp in a different location, replace `C:\Wemp` with your chosen installation path.

To add these paths:

1. Open Windows Settings (press `Win + I`)
2. Go to System > About > Advanced system settings
3. Click Environment Variables
4. Under "User variables", select Path and click Edit
5. Click New and add each path separately
6. Click OK to save

Once added, you can use commands like `php -v`, `mysql`, and `nginx -t` from your terminal. You may need to restart your terminal for the changes to take effect.

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
