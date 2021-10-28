<p align="center"><img src="https://user-images.githubusercontent.com/69470382/125867402-6a8af134-1e03-4d98-b1df-c347a2849c4e.png"></p>

<p align="center">
<a href="https://github.com/electronfriends/wemp/releases"><img src="https://img.shields.io/github/downloads/electronfriends/wemp/total.svg?style=flat-square" alt="Total Downloads"></a>
<a href="https://github.com/electronfriends/wemp/releases/latest"><img src="https://img.shields.io/github/v/release/electronfriends/wemp.svg?style=flat-square" alt="Latest Stable Version"></a>
<a href="https://github.com/electronfriends/wemp/issues"><img src="https://img.shields.io/github/issues/electronfriends/wemp.svg?style=flat-square" alt="GitHub Issues"></a>
<a href="LICENSE"><img src="https://img.shields.io/github/license/electronfriends/wemp.svg?style=flat-square" alt="License"></a>
</p>

## Introduction

Wemp is an easy to use menu to run [Nginx](https://nginx.org), [MariaDB](https://mariadb.org) and [PHP](https://php.net) easily on Windows.

Our goal is to always provide the latest version of these services without having to update them manually all the time.

## Features

- **Easy to use** for both beginners and experienced.

- **Regular updates** to always support the latest versions.

- **Database management** powered by [phpMyAdmin](https://www.phpmyadmin.net).

- **Error logging** in a separate log file so you can quickly locate errors.

- **Monitoring** of configuration files to restart the services automatically.

## Installation

1. Download and run the latest Wemp setup from the [Releases](https://github.com/electronfriends/wemp/releases/latest) page.

2. Choose the installation path for the services (the default is `C:\Wemp`).

3. Once everything is downloaded, you will be notified and the services will start automatically.

4. You can now get started at http://localhost and set up your database at http://localhost/phpmyadmin.

If you need help with something, [create a new issue](https://github.com/electronfriends/wemp/issues/new) and we'll be happy to help.

## FAQs

### How can I have Wemp start automatically at startup?

Press the Windows key + R, type `shell:startup` and press the Enter key. This will open the Explorer, where you'll need to create a shortcut of Wemp.

Once you have done that, Wemp will start automatically at startup.

### Will the services be deleted if I uninstall Wemp?

No. The services are installed independently of Wemp and remain untouched when Wemp is uninstalled.

## Thanks to

- [Electron](https://www.electronjs.org) for the tools to create a Windows application with JavaScript.

- [Nginx](https://nginx.org), [MariaDB](https://mariadb.org), [PHP](https://php.net) and [phpMyAdmin](https://www.phpmyadmin.net) for providing their services.

- [Icons8.com](https://icons8.com) for the free [Fluency](https://icons8.com/icon/set/logs/fluency) icons that we use in our menu.

- and all other dependencies we use to make Wemp work.

## Contributing

Thank you for your interest in contributing to Wemp. If you found a bug or have a suggestion, please let us know by [creating a new issue](https://github.com/electronfriends/wemp/issues/new).

We also welcome pull requests.

## License

Wemp is open-source software licensed under the [MIT License](LICENSE).
