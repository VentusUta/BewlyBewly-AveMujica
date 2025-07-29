# Contribution Guide

English | [官话 - 简体中文](CONTRIBUTING-cmn_CN.md) | [官話 - 正體中文](CONTRIBUTING-cmn_TW.md) | [廣東話](CONTRIBUTING-jyut.md)

## 💻 Setting up the Development Environment

This project is built using [Vite](https://vitejs.dev/), please make sure you have [bun](https://bun.com/) installed, and it is recommended to use [Visual Studio Code](https://code.visualstudio.com/) for development.

#### Building (Chrome or Edge)

To build the extension, run

```bash
bun run build
```

Then package it to the `extension` folder

#### Building (Firefox)

To build the extension, run

```bash
bun run build-firefox
```

Then package it to the `extension-firefox` folder

## 🤝 Contribution

### About Branches

- **main**: Use this branch for bug fixes, developing new features, performance improvements, or modifications to internationalization (i18n) files.

### I18n

- When doing translations, if you have a language you are not familiar with, you can use another language that you have translated and point out what language you cannot translate in the pull request.

- **Please MANUALLY MAINTAIN the i18n files!!!** Do not use `i18n Ally` or other extensions to maintain them. I know you might be confused or might not like this, but using `i18n Ally` for the maintenance will make it uncertain where to place the translations afterward or delete the code comments.
