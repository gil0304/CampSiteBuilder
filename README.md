# Camp Site Builder

キャンプ用品を3D区画へ配置し、安全性・動線・風・天気・日照・夜間照明を確認できるWebシミュレーターです。

## 起動

Node.js 22.13 以上を使用します。

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いてください。

## 確認

```bash
npm test
npx tsc --noEmit
```

## 主な操作

- アイコンをクリックしてアイテムを追加
- 3D上でドラッグして移動、ホイールで回転
- `Shift`＋ドラッグで高さ変更
- `Delete` で削除、`Command/Ctrl + D` で複製
- `Command/Ctrl + Z` で元に戻す
- 時刻・風・天気を画面下部から変更
- 保存メニューからブラウザ保存、JSON入出力、PNG出力

レイアウトデータはブラウザ内に保存されます。
