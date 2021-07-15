<p align="center">
    <img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png">
</p>

<p align="center">
    <a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg?style=flat-square" alt="Total Downloads"></a>
    <a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg?style=flat-square" alt="Latest Stable Version"></a>
    <a href="https://github.com/electronfriends/wemp/issues"><img src="https://img.shields.io/github/issues/electronfriends/wemp.svg?style=flat-square" alt="GitHub Issues"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg?style=flat-square" alt="License"></a>
</p>

## Introduction

Wemp is a menu to easily manage [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://php.net) on Windows.

Click on the icon in the notification area to open the menu and manage the services from there.

<p align="center"><img src="https://user-images.githubusercontent.com/69470382/107984444-3ba8e980-6fc8-11eb-8784-c714c8961ae4.png"></p>

## Features

- **Easy to use** for both beginners and experienced web developers.

- **Regular updates** to keep you up to date with the latest versions.

- **Database management** powered by [phpMyAdmin](https://www.phpmyadmin.net).

- **Error logging** in a separate log file to quickly determine the cause of errors.

- **Monitoring** of configuration files in order to restart services automatically.

## Installation

1. Download and run the latest Wemp setup from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.

2. Choose an installation path for the services (default is `C:\Wemp`).

3. As soon as everything has been downloaded and extracted, the services will start automatically and a notification appears.

4. You can now get started at http://localhost or manage your database at http://localhost/phpmyadmin.

If you need help with anything, [create a new issue](https://github.com/electronfriends/wemp/issues/new) and we will be happy to help.

## FAQs

### How can I have Wemp start automatically at startup?

Press the Windows key + R, type `shell:startup` and press the Enter key. This will open the Explorer, where you'll need to create a shortcut of Wemp.

Once you have done that, Wemp will start automatically at startup.

### Will my stuff be deleted if I uninstall Wemp?

No, don't worry about that. The services are separate from Wemp and will never be removed.

## Credits

- [Icons8.com](https://icons8.com) for the icons used in the menu.

## Contributing

Thank you for your interest in contributing to Wemp. If you've found a bug or have a feature suggestion, please let us know by [creating a new issue](https://github.com/electronfriends/wemp/issues/new).

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
