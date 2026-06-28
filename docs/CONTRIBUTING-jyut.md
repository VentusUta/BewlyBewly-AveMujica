# 貢獻指南

[English](CONTRIBUTING.md) | [官话 - 简体中文](CONTRIBUTING-cmn_CN.md) | [官話 - 正體中文](CONTRIBUTING-cmn_TW.md) | 廣東話

## 設定開發環境

呢份專案係用咗 [Vite](https://vitejs.dev/) 建立，請確保你已經單咗 [bun](https://bun.com/)，建議用 [Visual Studio Code](https://code.visualstudio.com/) 進行開發。

### 建置（Chrome 或 Edge）

建置延伸功能，要執行下底嘅指令：

```bash
bun run build
```

然之後打包 `extension` 下嘅檔案。

### 建置（Firefox）

建置延伸功能，要執行下底嘅指令：

```bash
bun run build-firefox
```

然之後打包 `extension-firefox` 下嘅檔案。

## 貢獻

### 許可證衝突警告

來自[BewlyCat](https://github.com/keleus/BewlyCat)嘅[`6b31a0310fa4cf20364353040c43643e9703ee8d`](https://github.com/keleus/BewlyCat/commit/6b31a0310fa4cf20364353040c43643e9703ee8d) commit同之後嘅commit**唔准喺呢個project度用**。呢個commit令到BewlyCat唔再係自由軟件，同我哋嘅[AGPLv3](../LICENSE)許可證唔相容。

### 受LLM輔助嘅提交

喺受LLM輔助嘅commit入面，唔好對個LLM用`Co-Authored-By:` tag，改用`Assisted-by:` tag。

**LLM唔係人類，佢哋冇辦法對code負責。**

### 分支

- **main**：用呢個分支進行執 bug、新功能嘅開發、改進效能抑或執語系檔（i18n）。

### i18n

- 喺翻譯嗰陣，若然你遇到一種你唔熟嘅語言，你可以用第種識翻譯嘅語言來翻譯，兼且喺 PR 講明你唔識譯邊種語言。
- **請手動維護 i18n 國際化語系檔**！請勿使用 `i18n Ally` 抑或其他擴充套件維護。 我知你可能唔係幾明，抑或可能唔鍾意咁樣，但係用 `i18n Ally` 進行維護之後，你唔之你翻譯咗嘅內容擺喺邊處，或剷咗程式碼註解。
