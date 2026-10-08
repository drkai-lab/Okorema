# Okorema!

完了するまで通知をやめない、ローカル優先のリマインダーです。iOS 17 以降と Android 14 以降を対象に、Expo（SDK 57）の開発ビルドで動きます。広告はありません。Google にサインインしなくても、リマインダーの作成から通知まで一通り使えます。端末上の保存は SQLite です。ブラウザでの確認用起動だけは、Metro が `wa-sqlite.wasm` を読み込めないため、同じ操作をインメモリで行います。iOS と Android の開発ビルドは SQLite のままです。

表示言語は端末の言語に従います。英語なら英語、それ以外は日本語です。

## 必要なもの

- Node.js 20 以上
- iOS をビルドする場合は macOS と Xcode（このリポジトリの検証環境は Linux のため、iOS のコンパイルは未実施です）
- Android をビルドする場合は Android SDK（compileSdk 36、minSdk 34）

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
npm run lint
npx expo prebuild
npx expo start --dev-client
```

`ios/` と `android/` は prebuild の生成物で、git には含めません。クライアント ID を変えたあとは、もう一度 prebuild して開発ビルドを作り直してください。

```bash
npx expo prebuild --platform android
npx expo prebuild --platform ios
npx expo run:android
npx expo run:ios
```

iOS のデプロイメントターゲットは 17.0、Android の minSdk は 34 です。識別子は `app.okorema.mobile`、URL スキームは `okorema` です。

## iPhone の Expo Go で試す

このアプリの Expo SDK は **57**（`expo` の `latest`）です。公式の案内では、**Apple App Store の Expo Go は SDK 54 で止まっていて、SDK 55 以降は配信されていません**。

- 不一致の説明: https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/
- SDK 57 のリリースノートでも、App Store 承認待ちのあいだ iOS 実機の Expo Go は `eas go` だと書かれています: https://expo.dev/changelog/sdk-57

そのため、App Store から入れた Expo Go でこのプロジェクトの QR を読むと、「Project is incompatible with this version of Expo Go」になります。SDK 54 へプロジェクト全体を下げると、Android の正確なアラーム、全画面インテント、Live Activity、ウィジェットの現行実装と揃わなくなるので、SDK は 57 のままです。iPhone で開くには、SDK 57 の Expo Go を自分の Apple Developer アカウントで配ります。

### 自分の PC で開発サーバーを立てる

Node.js 20 以上が要ります。リポジトリを取得したディレクトリで:

```bash
npm install
npx expo start --go --tunnel
```

`expo-dev-client` が入っているので、フラグなしの `npx expo start` は開発ビルド用の QR になります。Expo Go で開くときは必ず `--go` を付けるか、起動後に `s` を押して Expo Go に切り替えてください。別の Wi-Fi にいる iPhone からは `--tunnel` が必要です。同じ LAN なら `npx expo start --go` でも届きます。

1. iPhone に **SDK 57 の Expo Go** を入れます。App Store 版では足りません。Expo アカウントで `npx expo login` したあと、Apple Developer Program のメンバーシップがある Mac か、EAS が使える環境で次を実行し、TestFlight からインストールします。

   ```bash
   npx eas-cli go --sdk-version 57.0.0
   ```

   手順の補足: https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/ と https://github.com/expo/fyi/blob/main/personal-expo-go.md
2. PC のターミナルに出た QR を、iPhone のカメラか Expo Go のスキャンで読みます。
3. 初回は Expo の開発サーバーへの接続を許可します。最新の Expo Go は、CLI とアプリの両方で同じ Expo アカウントにログインしていることを求めることがあります。

Android の Expo Go は https://expo.dev/go から SDK 57 を選べます。Play ストア版が遅れているときは、そちらを使ってください。

### Expo Go で動くもの / 動かないもの

動くもの: リスト、リマインダー、繰り返し、完了とスヌーズ、粘りのあるローカル通知（Expo Go が許す範囲のアクション「完了にする」「10分後にスヌーズ」）、期限超過の全画面、バックアップの書き出しと追加読み込み。Pro は設定の「開発用にProを解放」で切り替えます。

動かないもの（起動時に読み込まず、画面で理由を出します）:

- ローカルモジュール `okorema-native`（Android の正確なアラーム、全画面インテント、常駐カウントダウン、ウィジェット、Keep への専用共有）。Keep への共有は OS の共有シートに落ちます。
- iOS の Live Activity / Dynamic Island とホームウィジェット（`expo-widgets`）。
- ストア課金（`expo-iap`）。購入と復元のボタンは無効で、開発用の Pro スイッチを使います。
- Google サインイン。`@react-native-google-signin/google-signin` は Expo Go に無く、`expo-auth-session` も Google が `exp://` のリダイレクトを拒否するため完了できません。同期画面にその旨を出します。
- iPhone リマインダー（EventKit）の読み込み。
- 場所の到着 / 離脱の監視。場所の文字列は保存できますが、ジオフェンスは登録しません。
- Time Sensitive は Expo Go 本体の権限次第で、通常の通知になることがあります。
- バックグラウンドの定期同期は登録しません。

### 開発サーバーなしで開く（EAS Update）

可能です。ただし次が要ります。

1. Expo アカウントを作り、自分の PC で `npx expo login` する。
2. プロジェクトを expo.dev に結びつける（`npx eas-cli init`）。`eas.json` がまだ無ければ CLI が案内します。
3. JS バンドルを公開する。

   ```bash
   npx eas-cli update --channel preview --platform ios --message "Expo Go preview"
   ```

4. 出たリンクまたは QR を、**SDK 57 の Expo Go**（上記の `eas go` で入れたもの）で開く。App Store の Expo Go（SDK 54）では同じリンクも開けません。
5. EAS Update に含まれるのは JavaScript だけです。カスタムのネイティブコードは入らないので、制限は上の Expo Go と同じです。

この環境にはユーザーの Expo アカウントが無いため、公開用の expo.dev リンクは作っていません。ログインは各自の PC で行ってください。

## 画面

初回はオンボーディングです。通知の許可は、期限のあるリマインダーを最初に保存するときにだけ尋ねます。追加ボタンは画面下の中央にあり、片手で届きます。期限を過ぎたリマインダーが残っているあいだ、アプリを開くと全画面の確認が先に出ます。完了、10分スヌーズ、または確認つきの削除を選ぶまで、ほかの操作はできません。「すべて10分後」はまとめてスヌーズします。

## 粘り通知

払う、無視する、アプリを終了する、いずれも通知は止まりません。止まるのは完了、スヌーズ、削除だけです。

| 段階 | 間隔 | 文面 | 利用 |
| --- | --- | --- | --- |
| やさしい | 0分、60分、180分、その後は240分ごと | いつも平易 | 無料 |
| ふつう | 0、15、30、60、90、120分、その後は60分ごと | 1回目は平易、2回目から強い口調 | 無料 |
| 鬼モード | 10分間隔で13回（0分から120分）、その後は180分から60分ごと | 1回目から強い口調 | Pro（買い切り） |

Pro でない端末に鬼モードの予定が残っている場合、保存した段階はそのままにし、実際の予約は「ふつう」と同じ間隔になります。

各通知の文言は予約した時点の回数で決まります。アプリを再起動しても回数は 1 に戻りません。経過した回は保存済みの次インデックスから消化し、次の未送信だけを予約し直します。スヌーズは起点を付け替えて、新しい系列を 1 回目から始めます。スヌーズは端末内だけで、カレンダーの開始時刻には書き戻しません。

iOS が同時に保留できるローカル通知は 64 件です。事前通知を先に確保し、残りを近い期限からラウンドロビンで割り当てます。枠が足りず粘りが薄くなるときは、ホームに警告を出します。Android 側のアラーム予算は 180 件です。

事前通知は 5 / 10 / 15 / 30 / 45 / 60 分前の一回です。通知アクションは「完了にする」と「10分後にスヌーズ」です。iOS の割り込みレベルは Time Sensitive です。Android は重要度の高いチャンネル、正確なアラーム、全画面インテント、起動完了後の再登録に対応します。Android 14 では正確なアラームと全画面インテントが未許可のとき、設定から開ける案内を出します。

## 繰り返しと二重完了

毎日、平日、毎週、毎月です。完了すると、いまよりあとの次の発生へ進みます。毎月は最初の期限日を起点に計算するので、1月31日の次が2月28日になっても、その次は3月31日のままです。

同じ操作 ID、またはすでに進んだ発生キーでの再完了は無視します。通知とアプリ内の両方が届いても、二重には進みません。完了とスヌーズは一つ戻せます。

## Pro と場所

商品 ID は非消耗型の `okorema_pro_unlock` です。購入処理は `expo-iap` の背後にあり、画面は権利の有無だけを見ます。開発ビルドでは設定の「開発者向け」から Pro を切り替えられます。

場所リマインダーは到着または離脱、半径は 100 / 300 / 500 メートルです。場所検索は OpenStreetMap の Nominatim で、現在地からの距離順です。Google Places のキーは要りません。

## バックアップ

一つの JSON ファイルです。形式名は `okorema-backup`、版は 1。書き出しは共有シート（ファイルアプリへの保存を含む）です。読み込みは同じ ID を飛ばす追加だけで、既存の行は消しません。

## Google 同期

サインインは `@react-native-google-signin/google-signin` です。最初のスコープはメールとプロフィールだけで、カレンダー、ToDo、Keep はスイッチを入れたときに追加します。アクセストークンは `expo-secure-store` に置きます。同期はアプリを開いたときと、OS が許す範囲のバックグラウンド周期です。

衝突は項目ごとです。タイトル、メモ、期限、完了、リストについて、より新しい時刻を採用します。同時刻ならこの端末を残します。対応表は `(provider, localKind, localId)` とリモート ID で一意なので、同じ予定を二度作りません。リモートに Okorema の ID が残っていれば、対応表が欠けていてもそれを再利用します。

### Cloud プロジェクト

実在のクライアント ID や秘密はリポジトリに置いていません。`.env` は gitignore です。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作ります。
2. 次の API を有効にします。Google Calendar API、Google Tasks API。Keep を使う組織だけ Google Keep API も有効にします。
3. OAuth 同意画面を作り、スコープに `calendar`、`tasks`、必要な組織だけ `https://www.googleapis.com/auth/keep` を足します。テスト中はテストユーザーを登録します。
4. 認証情報で「ウェブアプリケーション」のクライアント ID を作り、`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` にします。Android の ID トークン検証に使います。
5. iOS クライアントを作り、バンドル ID は `app.okorema.mobile` です。クライアント ID を `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` に、反転したスキーム（`com.googleusercontent.apps.` で始まるもの）を `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` にします。
6. Android クライアントを作り、パッケージ名は `app.okorema.mobile`、SHA-1 は開発ビルドの署名証明書です。`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` は控えです。実行時の照合はパッケージ名と SHA-1 で行われます。
7. `.env` を置いてから `npx expo prebuild` と開発ビルドをやり直します。未設定のまま起動してもアプリは使え、サインイン時に設定不足と出ます。

カレンダーは、選んだカレンダーか、専用に作る「Okorema!」カレンダーへ双方向です。期限のある予定だけを送り、繰り返しは RRULE（毎日、平日、毎週、毎月）に写します。対応できない RRULE は `externalRecurrence` として保持し、ユーザーが繰り返しを変えるまで書き換えません。繰り返さない予定を完了するとカレンダー側の予定は削除します。繰り返しの系列は残します。

Google ToDo はリストとタスクを双方向に写します。タイトル、メモ、期限、完了が対象です。Tasks API の期限は日付だけで、時刻部分は捨てられます。時刻はこの端末と、メモ末尾の `<!-- okorema id=… dueTime=HH:mm -->` に残します。ToDo の画面では時刻を編集できません。

### Keep API の結論

公式ドキュメントを確認した範囲では、Google Keep API は Google Workspace の組織向けです。個人の Gmail では使えません。

- ガイド（2026-09-03 更新）: 管理者とドメイン全体の委任、監査やコンプライアンス用途が説明されています。https://developers.google.com/workspace/keep/api/guides
- REST メソッドは notes の create、delete、get、list と、権限、メディアのダウンロードです。更新メソッドはありません。https://developers.google.com/workspace/keep/api/reference/rest
- 作成: https://developers.google.com/workspace/keep/api/reference/rest/v1/notes/create と https://developers.google.com/workspace/keep/api/guides/create-notes
- 認証の切り分け: https://developers.google.com/workspace/keep/api/troubleshoot-authentication-authorization
- エンドポイントは `https://keep.googleapis.com/v1/notes`、スコープは `https://www.googleapis.com/auth/keep` です。

このアプリの扱い:

- ID トークンの `hd`（ホストドメイン）があるアカウントだけ Keep API を試します。
- 管理者の承認不足や 401 / 403 のときは同期を止め、画面で理由を示します。
- 更新 API がないため、内容の変更は新しいノートを作ってから古いノートを消します。
- 個人アカウントでは API を呼ばず、説明を出したうえで Android では Keep アプリへの共有インテント（未インストールなら共有シート）を使います。

## 参照アプリとの機能対応

名前、図版、マスコット、文言は写していません。Okorema! の印は環と中心の点です。

| 機能 | 状態 |
| --- | --- |
| 完了まで続く粘り通知（やさしい / ふつう / 鬼モード） | 実装。回数は再起動後も保持 |
| iOS 64 件の枠と警告 | 実装 |
| 期限超過時の全画面ロック（完了 / 10分 / すべて10分 / 確認つき削除） | 実装 |
| リスト（13色、16アイコン、並べ替え） | 実装。並べ替えは上へ / 下へ |
| ホームの次の3件、今日、完了は既定で最新5件 | 実装 |
| 毎日・平日・毎週・毎月。完了で次へ。二重進行の防止と取り消し | 実装 |
| iOS リマインダーの読み取り専用取り込み（期限なしと繰り返しは除外） | 実装。Android には EventKit 相当がない |
| 5分から1時間の事前通知 | 実装 |
| 通知から完了と10分スヌーズ | 実装 |
| iOS Live Activity / Dynamic Island | コードあり。macOS がないため未コンパイル |
| Android の常駐カウントダウン通知 | 実装 |
| ホームウィジェット（次の予定、期限超過、今日、直近7日の完了数） | iOS は expo-widgets、Android は RemoteViews。連続日数ではない |
| iOS Time Sensitive | entitlement と interruptionLevel を設定。実機の Focus 突破は未検証 |
| Android の高優先度、正確なアラーム、全画面、再起動後 | 実装 |
| Pro 買い切り（鬼モードと場所） | `expo-iap` と開発用スイッチ |
| バックアップの書き出しと追加読み込み | 実装 |
| 初回案内、初回保存時の通知許可、文字の拡大、読み上げラベル、下の追加ボタン | 実装 |
| 広告なし、アカウントなし、SQLite | 実装 |
| Google カレンダー双方向 | 実装（要クライアント ID） |
| Google ToDo 双方向 | 実装。期限は日付のみ |
| Google Keep | Workspace のみ API。個人は共有 |

## 検証と未検証

`npm test`、`npm run typecheck`、`npm run lint`、`npx expo prebuild`、`npx expo export --platform ios` は通しています。Android は `./gradlew assembleDebug` でデバッグ APK（arm64-v8a、Pixel 8 向け）まで通しています。Linux では Xcode がないため、次は未検証です。

- iOS のネイティブコンパイル、Live Activity、ホーム画面ウィジェット、Time Sensitive の Focus 突破
- EventKit からの実取り込み
- StoreKit / Play Billing のサンドボックス購入
- 実機の正確なアラーム許可と全画面インテント
- 実機の iPhone での Expo Go 起動（この環境に iPhone はない。iOS の JS バンドル書き出しだけ確認済み）

システムイメージを置いていないため、エミュレータへのインストールはしていません。APK は arm64-v8a だけなので、x86_64 のエミュレータには載りません。

## テスト

対象は予定の組み立てと粘りの継続、繰り返しの進行、スヌーズ、期限超過、同期の対応表と衝突です。

```bash
npm test
```
