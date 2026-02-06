# CH_like_game

## 実行方法

1. ターミナルでプロジェクトへ移動
```
cd /Users/mineo.matsuya/Desktop/code/CH_like_game
```

2. ローカルサーバを起動
```
python -m http.server 5173
```

3. ブラウザで開く
```
http://localhost:5173
```

4. 不足アセットを同期（初回推奨）
```
npm run sync:assets
```

## 操作

- 上部タブ「編集」: AIエディタ
- 上部タブ「テスト」: ダンジョン（Start / Pause / Reset で進行）
- Space: Start/Pause
- F: フルスクリーン
- 盤面三角矢印クリック: 方向回転（↑→↓←）
- Shift + 盤面三角矢印クリック: 逆回転
- Alt + 盤面三角矢印クリック（条件チップ）: True/False を同方向に揃える

## 備考

- チップ配置は `NOP=シングルクリック`、`NOP以外=ダブルクリック` です。
- 一部アセット（trap/treasure系）が未配置の場合はプレースホルダーで表示されます。
