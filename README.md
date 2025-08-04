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

Wemp is a modern local web development stack that brings [Nginx](https://nginx.org), [MariaDB](https://mariadb.org), and [PHP](https://www.php.net) to Windows with zero configuration.

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

Wemp makes it easy to add these services to your PATH environment variable directly from the application:

1. Right-click the Wemp icon in your system tray
2. Check "Add Services to PATH" in the menu
3. That's it! You can now use commands like `php -v`, `mysql`, and `nginx -t` from any terminal

Alternatively, you can manually add the paths to your user's PATH environment variable:

- PHP: `C:\Wemp\php`
- MariaDB: `C:\Wemp\mariadb\bin`
- Nginx: `C:\Wemp\nginx`

Note: If you installed Wemp in a different location, replace `C:\Wemp` with your chosen installation path.

### Can I use a specific PHP version?

No, Wemp is designed to provide the latest stable versions of all services for optimal security and performance. The application automatically manages updates to ensure you're always running the most recent supported versions of PHP, MariaDB, and Nginx.

### Why does the tray icon move to the hidden area after updating?

This is a Windows behavior caused by how Squirrel (our updater) works. Each update installs the application in a new versioned folder, which Windows treats as a completely new application even though it's the same program. You can drag the Wemp icon back to the visible tray area, and Windows will remember this preference until the next update.

### How do I move my services folder?

To move your services folder to a different location:

1. Stop Wemp completely (right-click tray icon → Exit)
2. Manually move your services folder (e.g., from `C:\Wemp` to `D:\Development\Wemp`)
3. Start Wemp again
4. When prompted, select your new services folder location

Wemp doesn't handle folder moves automatically to prevent unexpected failures or potential file losses during the transfer process.

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
