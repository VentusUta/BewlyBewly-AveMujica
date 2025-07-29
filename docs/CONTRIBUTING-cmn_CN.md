# 贡献指南

[English](CONTRIBUTING.md) | 官话 - 简体中文 | [官話 - 正體中文](CONTRIBUTING-cmn_TW.md) | [廣東話](CONTRIBUTING-jyut.md)

## 💻 设置开发环境

此项目是基于 [Vite](https://vitejs.dev/) 构建的，请确保安装了 [bun](https://bun.com/)，
同时建议你用 [Visual Studio Code](https://code.visualstudio.com/) 进行开发。

#### 构建 (Chrome or Edge)

要构建拓展程序，运行

```bash
bun run build
```

然后打包到 `extension` 文件夹

#### 构建 (Firefox)

要构建拓展程序，运行

```bash

bun run build-firefox

```

然后打包到 `extension-firefox` 文件夹

## 🤝 贡献

### 关于分支

- **main**: 用此分支进行错误修复、新功能的开发、性能改进或对国际化（i18n）文件的修改。

### I18n

- 在进行翻译时，如果你遇到一种你不熟悉的语言，可以使用另一种你已经翻译过的语言，并在 PR 中指出你无法翻译的语言。

- **请手动维护 i18n 国际化文件！！！** 不要使用 `i18n Ally` 或其他扩展来维护它们。我知道你可能会感到困惑或不喜欢这样做，但使用 `i18n Ally` 进行维护会不确定翻译放在哪里或删除代码注释。
