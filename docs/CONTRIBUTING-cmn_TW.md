# 貢獻指南

[English](CONTRIBUTING.md) | [官话 - 简体中文](CONTRIBUTING-cmn_CN.md) | 官話 - 正體中文 | [廣東話](CONTRIBUTING-jyut.md)

## 💻 設定開發環境

此專案使用 [Vite](https://vitejs.dev/) 構建，請確保你安裝了 [bun](https://bun.com/)，並推薦使用 [Visual Studio Code](https://code.visualstudio.com/) 進行開發。

#### 建置（Chrome 或 Edge）

建置此擴充功能，需要執行以下指令

```bash
bun run build
```

然後打包 `extension` 下的檔案

#### 建置（Firefox）

要構建擴展，運行

```bash
bun run build-firefox
```

然後打包 `extension-firefox` 下的檔案

## 🤝 貢獻

### 關於分支

- **main**：用於錯誤修正開發新功能、性能改進或修改國際化（i18n）文件的分支。

### I18n

- 在進行翻譯時，如果你遇到一種你不熟悉的語言，你可以使用另一種你已經翻譯過的語言來翻譯，並在 PR 中指出你無法翻譯的那個語言。
- **請手動維護 i18n 國際化語系檔！！！** 請勿使用 `i18n Ally` 或其他擴充套件來進行維護。 我知道你可能會感到困惑，或者可能不喜歡這樣做，但使用 `i18n Ally` 進行維護後，將不確定翻譯放在哪裏，或刪除程式碼註解。
