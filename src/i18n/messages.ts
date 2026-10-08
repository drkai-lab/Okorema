export type Messages = {
  appName: string;
  tagline: string;
  home: string;
  lists: string;
  settings: string;
  add: string;
  addReminder: string;
  nextUp: string;
  today: string;
  completed: string;
  showMore: string;
  showLess: string;
  emptyHomeTitle: string;
  emptyHomeBody: string;
  emptyListTitle: string;
  emptyListBody: string;
  emptyListsTitle: string;
  emptyListsBody: string;
  suggestedLists: string;
  shopping: string;
  work: string;
  health: string;
  overdueTitle: string;
  overdueBody: string;
  done: string;
  snooze10: string;
  snoozeAll: string;
  delete: string;
  deleteConfirmTitle: string;
  deleteConfirmBody: string;
  cancel: string;
  save: string;
  editList: string;
  newList: string;
  listName: string;
  color: string;
  icon: string;
  moveUp: string;
  moveDown: string;
  title: string;
  notes: string;
  due: string;
  noDue: string;
  clearDue: string;
  preNotify: string;
  preNotifyOff: string;
  repeat: string;
  repeatNone: string;
  repeatDaily: string;
  repeatWeekdays: string;
  repeatWeekly: string;
  repeatMonthly: string;
  persistence: string;
  gentle: string;
  normal: string;
  oni: string;
  oniLocked: string;
  gentleHint: string;
  normalHint: string;
  oniHint: string;
  geofence: string;
  geofenceLocked: string;
  arrive: string;
  leave: string;
  radius: string;
  placeSearch: string;
  placePlaceholder: string;
  useCurrentLocation: string;
  searching: string;
  noPlaces: string;
  locationNeeded: string;
  undo: string;
  undone: string;
  completedJustNow: string;
  budgetWarning: (scheduled: number, desired: number) => string;
  permissionTitle: string;
  permissionBody: string;
  allow: string;
  later: string;
  exactAlarmTitle: string;
  exactAlarmBody: string;
  fullScreenTitle: string;
  fullScreenBody: string;
  openSettings: string;
  onboarding1Title: string;
  onboarding1Body: string;
  onboarding2Title: string;
  onboarding2Body: string;
  onboarding3Title: string;
  onboarding3Body: string;
  start: string;
  next: string;
  skip: string;
  loading: string;
  loadError: string;
  retry: string;
  settingsLead: string;
  notifications: string;
  importDevice: string;
  importDeviceIos: string;
  importDeviceAndroid: string;
  importResult: (count: number) => string;
  importDenied: string;
  backup: string;
  backupLead: string;
  exportBackup: string;
  importBackup: string;
  importAdded: (lists: number, reminders: number) => string;
  importFailed: string;
  sync: string;
  syncLead: string;
  signIn: string;
  signOut: string;
  signedInAs: (email: string) => string;
  missingGoogleConfig: string;
  calendarSync: string;
  tasksSync: string;
  keepSync: string;
  chooseCalendar: string;
  dedicatedCalendar: string;
  syncNow: string;
  lastSync: string;
  neverSynced: string;
  syncFailed: string;
  conflictPolicy: string;
  tasksLimitation: string;
  keepWorkspace: string;
  keepPersonal: string;
  keepWorking: string;
  shareToKeep: string;
  pro: string;
  proLead: string;
  proPriceNote: string;
  purchase: string;
  restore: string;
  proUnlocked: string;
  proDev: string;
  devUnlock: string;
  devLock: string;
  seedDemo: string;
  about: string;
  aboutBody: string;
  language: string;
  languageValue: string;
  weekCompleted: (count: number) => string;
  overdueCount: (count: number) => string;
  noUpcoming: string;
  reminderTitlePlaceholder: string;
  requiredTitle: string;
  notifActions: string;
  liveActivity: string;
  widgetHelp: string;
  accountFree: string;
  noAds: string;
  geofenceProOnly: string;
  persistenceProOnly: string;
  minutesBefore: (minutes: number) => string;
  deleteListBody: string;
  todayEmpty: string;
  completedEmpty: string;
  close: string;
  continueLabel: string;
  googleCalendar: string;
  googleTasks: string;
  googleKeep: string;
  syncing: string;
  saved: string;
  radiusMeters: (meters: number) => string;
  placeDistance: (km: string) => string;
  editorLead: string;
  list: string;
  createListInline: string;
  noneYet: string;
  systemStatus: string;
  exactAlarmReady: string;
  exactAlarmMissing: string;
  fullScreenReady: string;
  fullScreenMissing: string;
  notifReady: string;
  notifMissing: string;
  devSection: string;
  expoGoLimits: string;
  expoGoGoogle: string;
  expoGoPro: string;
  expoGoImport: string;
  expoGoWidgets: string;
  expoGoGeofence: string;
};

export const ja: Messages = {
  appName: "Okorema!",
  tagline: "完了するまで、通知をやめない",
  home: "ホーム",
  lists: "リスト",
  settings: "設定",
  add: "追加",
  addReminder: "リマインダーを追加",
  nextUp: "次の3件",
  today: "今日",
  completed: "完了",
  showMore: "完了をもっと見る",
  showLess: "最新5件だけ表示",
  emptyHomeTitle: "まだリマインダーがありません",
  emptyHomeBody: "下の追加ボタンから、忘れかけていることを一つ置いてください。",
  emptyListTitle: "このリストは空です",
  emptyListBody: "買い物でも、締め切りでも、ここに足せます。",
  emptyListsTitle: "リストがありません",
  emptyListsBody: "色とアイコンを付けて、用事の置き場を作れます。",
  suggestedLists: "まずはこの3つから",
  shopping: "買い物",
  work: "仕事",
  health: "健康",
  overdueTitle: "まだ終わっていません",
  overdueBody: "期限を過ぎたリマインダーがあります。完了かスヌーズを選ぶまで、ほかの操作はできません。",
  done: "完了した",
  snooze10: "10分後にスヌーズ",
  snoozeAll: "すべて10分後",
  delete: "削除",
  deleteConfirmTitle: "削除しますか？",
  deleteConfirmBody: "まちがって作ったときだけ削除してください。通知も止まります。",
  cancel: "キャンセル",
  save: "保存",
  editList: "リストを編集",
  newList: "新しいリスト",
  listName: "リスト名",
  color: "色",
  icon: "アイコン",
  moveUp: "上へ",
  moveDown: "下へ",
  title: "タイトル",
  notes: "メモ",
  due: "期限",
  noDue: "期限なし",
  clearDue: "期限を消す",
  preNotify: "事前通知",
  preNotifyOff: "なし",
  repeat: "繰り返し",
  repeatNone: "なし",
  repeatDaily: "毎日",
  repeatWeekdays: "平日",
  repeatWeekly: "毎週",
  repeatMonthly: "毎月",
  persistence: "粘り強さ",
  gentle: "やさしい",
  normal: "ふつう",
  oni: "鬼モード",
  oniLocked: "鬼モードは買い切りのProです",
  gentleHint: "間隔をあけて、淡々と知らせます。",
  normalHint: "2回目から、少し強い口調になります。",
  oniHint: "2時間で13回、その後は1時間ごとに、完了まで続きます。",
  geofence: "場所",
  geofenceLocked: "場所リマインダーはProです",
  arrive: "着いたら",
  leave: "離れたら",
  radius: "半径",
  placeSearch: "場所を検索",
  placePlaceholder: "駅、店、住所",
  useCurrentLocation: "いまの場所を使う",
  searching: "検索しています",
  noPlaces: "近くの候補が見つかりません",
  locationNeeded: "現在地の許可が必要です",
  undo: "元に戻す",
  undone: "一つ前に戻しました",
  completedJustNow: "完了にしました",
  budgetWarning: (scheduled, desired) =>
    `iOSに予約できる通知は64件までです。本当は${desired}件必要なところ、いまは${scheduled}件だけ予約しています。一部のリマインダーは、粘り通知の間隔が薄くなります。`,
  permissionTitle: "通知を使います",
  permissionBody: "完了するまで知らせるために、通知の許可が必要です。初回のリマインダーを保存するときだけ尋ねます。",
  allow: "許可する",
  later: "今はしない",
  exactAlarmTitle: "正確なアラーム",
  exactAlarmBody: "Android 14では、時間どおりに鳴らす許可を設定から選べます。",
  fullScreenTitle: "全画面のアラーム",
  fullScreenBody: "ロック画面の上に出す許可がオフだと、通知は来ても画面いっぱいは開きません。",
  openSettings: "設定を開く",
  onboarding1Title: "完了するまで止まりません",
  onboarding1Body: "通知を払っても、Okorema! は完了にするまで繰り返します。アカウントは要りません。",
  onboarding2Title: "三つの粘り方",
  onboarding2Body: "やさしいとふつうは無料です。鬼モードは2時間に13回、その後は1時間ごと。口調も段階で変わります。",
  onboarding3Title: "同期はあとから",
  onboarding3Body: "まずはこの端末だけで使えます。Googleカレンダー、ToDo、WorkspaceのKeepは設定から任意でつなぎます。",
  start: "はじめる",
  next: "次へ",
  skip: "スキップ",
  loading: "読み込んでいます",
  loadError: "データを開けませんでした",
  retry: "再試行",
  settingsLead: "通知、バックアップ、Google同期。広告はありません。",
  notifications: "通知",
  importDevice: "端末のリマインダーを読み込む",
  importDeviceIos: "iPhoneのリマインダーから、期限があり繰り返しでないものだけ読みます。元のデータは変更しません。",
  importDeviceAndroid: "この取り込みはiOSのリマインダー（EventKit）専用です。Androidでは使えません。",
  importResult: (count) => `${count}件読み込みました`,
  importDenied: "リマインダーへのアクセスが許可されませんでした",
  backup: "バックアップ",
  backupLead: "一つのファイルに書き出します。読み込みは足すだけで、いまのデータを消しません。",
  exportBackup: "ファイルに書き出す",
  importBackup: "ファイルを読み込む",
  importAdded: (lists, reminders) => `リスト${lists}件、リマインダー${reminders}件を足しました`,
  importFailed: "このファイルはOkorema!のバックアップではありません",
  sync: "Google同期",
  syncLead: "サインインしなくてもアプリは全部使えます。つなぐ相手はあとから増やせます。",
  signIn: "Googleでサインイン",
  signOut: "サインアウト",
  signedInAs: (email) => `${email} で接続中`,
  missingGoogleConfig: "GoogleのクライアントIDが未設定です。READMEの手順で環境変数を入れてから開発ビルドを作り直してください。",
  calendarSync: "カレンダー",
  tasksSync: "ToDo",
  keepSync: "Keep",
  chooseCalendar: "同期するカレンダー",
  dedicatedCalendar: "Okorema! 専用カレンダーを作る",
  syncNow: "いま同期",
  lastSync: "最終同期",
  neverSynced: "まだ同期していません",
  syncFailed: "同期できませんでした",
  conflictPolicy: "同じ項目を両方で直したときは、項目ごと（タイトル、メモ、期限、完了、リスト）に新しい時刻の方を採用します。同時刻ならこの端末を残します。",
  tasksLimitation: "Google ToDoの期限は日付だけです。時刻はこの端末と、メモ末尾の印に残します。ToDo側では時刻を編集できません。",
  keepWorkspace: "Keep APIはGoogle Workspaceの組織向けです。管理者によるスコープ承認が必要なことがあり、個人のGmailでは使えません。",
  keepPersonal: "このアカウントは個人用のGoogleアカウントです。Keep APIは呼べないので、共有シートからKeepへ渡せます。",
  keepWorking: "WorkspaceアカウントとしてKeepへ同期できます。公式APIに更新メソッドがないため、変更時はノートを作り直します。",
  shareToKeep: "Keepに共有",
  pro: "Pro",
  proLead: "買い切りです。サブスクリプションではありません。鬼モードと場所リマインダーが開きます。",
  proPriceNote: "ストアの価格はApp Store / Google Playの表示が正です。開発中は下のスイッチで試せます。",
  purchase: "Proを購入",
  restore: "購入を復元",
  proUnlocked: "Proは有効です",
  proDev: "開発用にProを解放",
  devUnlock: "開発用Proをオンにしました",
  devLock: "開発用Proをオフにしました",
  seedDemo: "サンプルデータを入れる",
  about: "Okorema! について",
  aboutBody: "ローカル優先のリマインダーです。完了するまで通知が続きます。広告もアカウントもありません。",
  language: "表示言語",
  languageValue: "日本語（端末の設定に従う）",
  weekCompleted: (count) => `直近7日で完了 ${count}`,
  overdueCount: (count) => `期限超過 ${count}`,
  noUpcoming: "これからの予定はありません",
  reminderTitlePlaceholder: "何を忘れない？",
  requiredTitle: "タイトルを入れてください",
  notifActions: "通知から「完了にする」と「10分後にスヌーズ」が使えます。",
  liveActivity: "次の予定は、ロック画面とDynamic Islandにカウントダウンを出します。Androidでは常駐通知のカウントダウンです。",
  widgetHelp: "ホーム画面のウィジェットに、次の予定、期限超過、今日の一覧、直近7日の完了数が載ります。連続日数ではありません。",
  accountFree: "アカウント不要",
  noAds: "広告なし",
  geofenceProOnly: "場所リマインダーを使うにはProが必要です",
  persistenceProOnly: "鬼モードを使うにはProが必要です",
  minutesBefore: (minutes) => `${minutes}分前`,
  deleteListBody: "リストの中のリマインダーも削除します。",
  todayEmpty: "今日の予定はありません",
  completedEmpty: "完了した項目はまだありません",
  close: "閉じる",
  continueLabel: "続ける",
  googleCalendar: "Googleカレンダー",
  googleTasks: "Google ToDo",
  googleKeep: "Google Keep",
  syncing: "同期しています",
  saved: "保存しました",
  radiusMeters: (meters) => `${meters} m`,
  placeDistance: (km) => `${km} km`,
  editorLead: "期限、繰り返し、事前通知、粘り方をここで決めます。",
  list: "リスト",
  createListInline: "リスト名を決めて作る",
  noneYet: "未設定",
  systemStatus: "この端末の通知",
  exactAlarmReady: "正確なアラームは許可されています",
  exactAlarmMissing: "正確なアラームが未許可です",
  fullScreenReady: "全画面インテントは許可されています",
  fullScreenMissing: "全画面インテントが未許可です",
  notifReady: "通知は許可されています",
  notifMissing: "通知はまだ許可されていません",
  devSection: "開発者向け",
  expoGoLimits:
    "Expo Go では、リスト、リマインダー、繰り返し、ローカル通知（完了と10分スヌーズ）、期限超過の全画面、バックアップが使えます。Live Activity、ホームウィジェット、ストア課金、iPhoneリマインダーの読み込み、場所の監視、このアプリ専用のネイティブ機能は開発ビルドが必要です。Proの確認は「開発用にProを解放」を使ってください。",
  expoGoGoogle:
    "Expo Go では Google サインインを使えません。Google は Expo Go の exp:// リダイレクトを受け付けず、ネイティブの Google Sign-In も Expo Go には入りません。カレンダー同期は開発ビルドで試してください。",
  expoGoPro: "Expo Go にはストア課金が入っていません。鬼モードと場所の確認は「開発用にProを解放」を使ってください。",
  expoGoImport: "Expo Go では iPhone のリマインダー（EventKit）を読み込めません。開発ビルドが必要です。",
  expoGoWidgets: "Expo Go では Live Activity とホームウィジェットは動きません。通知そのものは届きます。Time Sensitive の割り込みは Expo Go 側の権限に依存し、通常の通知になることがあります。",
  expoGoGeofence: "Expo Go では到着と離脱の監視は動きません。場所の内容は保存されますが、通知は出ません。",
};

export const en: Messages = {
  appName: "Okorema!",
  tagline: "It keeps notifying until you are done",
  home: "Home",
  lists: "Lists",
  settings: "Settings",
  add: "Add",
  addReminder: "Add a reminder",
  nextUp: "Next 3",
  today: "Today",
  completed: "Completed",
  showMore: "Show more completed",
  showLess: "Show latest 5",
  emptyHomeTitle: "No reminders yet",
  emptyHomeBody: "Use the add button at the bottom to park the one thing you keep forgetting.",
  emptyListTitle: "This list is empty",
  emptyListBody: "A grocery item or a deadline both belong here.",
  emptyListsTitle: "No lists yet",
  emptyListsBody: "Give a list a color and an icon, then put reminders in it.",
  suggestedLists: "Start with these three",
  shopping: "Shopping",
  work: "Work",
  health: "Health",
  overdueTitle: "Still open",
  overdueBody: "These reminders are overdue. Choose done or snooze before doing anything else.",
  done: "Done",
  snooze10: "Snooze 10 min",
  snoozeAll: "Snooze all 10 min",
  delete: "Delete",
  deleteConfirmTitle: "Delete this reminder?",
  deleteConfirmBody: "Delete only if you created it by mistake. Notifications stop.",
  cancel: "Cancel",
  save: "Save",
  editList: "Edit list",
  newList: "New list",
  listName: "List name",
  color: "Color",
  icon: "Icon",
  moveUp: "Move up",
  moveDown: "Move down",
  title: "Title",
  notes: "Notes",
  due: "Due",
  noDue: "No due time",
  clearDue: "Clear due time",
  preNotify: "Heads-up",
  preNotifyOff: "Off",
  repeat: "Repeat",
  repeatNone: "Never",
  repeatDaily: "Daily",
  repeatWeekdays: "Weekdays",
  repeatWeekly: "Weekly",
  repeatMonthly: "Monthly",
  persistence: "Persistence",
  gentle: "Gentle",
  normal: "Normal",
  oni: "Oni mode",
  oniLocked: "Oni mode is part of the one-time Pro unlock",
  gentleHint: "Plain wording, with long gaps.",
  normalHint: "A firmer tone starts on the second notice.",
  oniHint: "13 notices in the first 2 hours, then hourly until you mark it done.",
  geofence: "Place",
  geofenceLocked: "Place reminders are part of Pro",
  arrive: "On arrival",
  leave: "On leaving",
  radius: "Radius",
  placeSearch: "Search places",
  placePlaceholder: "Station, shop, address",
  useCurrentLocation: "Use current location",
  searching: "Searching",
  noPlaces: "No nearby matches",
  locationNeeded: "Location permission is required",
  undo: "Undo",
  undone: "Restored the previous state",
  completedJustNow: "Marked done",
  budgetWarning: (scheduled, desired) =>
    `iOS allows 64 pending notifications. This plan needs ${desired}, so only ${scheduled} are scheduled. Some reminders cannot keep their full persistence.`,
  permissionTitle: "Notifications",
  permissionBody: "Okorema needs notification permission to keep going until you mark a reminder done. It asks when you save the first one.",
  allow: "Allow",
  later: "Not now",
  exactAlarmTitle: "Exact alarms",
  exactAlarmBody: "On Android 14, exact timing is a setting you can turn on.",
  fullScreenTitle: "Full-screen alarms",
  fullScreenBody: "If full-screen intents are off, alarms still notify but cannot cover the lock screen.",
  openSettings: "Open settings",
  onboarding1Title: "It does not stop until you are done",
  onboarding1Body: "Swiping a notification away does not finish it. Okorema keeps going until you mark it done. No account required.",
  onboarding2Title: "Three levels of persistence",
  onboarding2Body: "Gentle and Normal are free. Oni mode sends 13 notices in two hours, then hourly. The wording changes with the level.",
  onboarding3Title: "Sync can wait",
  onboarding3Body: "The app works fully on this device. Google Calendar, Tasks, and Workspace Keep are optional in Settings.",
  start: "Start",
  next: "Next",
  skip: "Skip",
  loading: "Loading",
  loadError: "Could not open your data",
  retry: "Try again",
  settingsLead: "Notifications, backup, and Google sync. No ads.",
  notifications: "Notifications",
  importDevice: "Import device reminders",
  importDeviceIos: "Reads iPhone reminders that have a due date and do not repeat. Nothing is changed in the source list.",
  importDeviceAndroid: "This import uses iOS Reminders (EventKit) and is not available on Android.",
  importResult: (count) => `Imported ${count}`,
  importDenied: "Reminders access was not granted",
  backup: "Backup",
  backupLead: "Export one file. Import only adds rows and never deletes what is already here.",
  exportBackup: "Export file",
  importBackup: "Import file",
  importAdded: (lists, reminders) => `Added ${lists} lists and ${reminders} reminders`,
  importFailed: "That file is not an Okorema backup",
  sync: "Google sync",
  syncLead: "The app stays fully usable if you never sign in. You can connect one service at a time.",
  signIn: "Sign in with Google",
  signOut: "Sign out",
  signedInAs: (email) => `Connected as ${email}`,
  missingGoogleConfig: "Google client IDs are not set. Follow the README, then rebuild the dev client.",
  calendarSync: "Calendar",
  tasksSync: "Tasks",
  keepSync: "Keep",
  chooseCalendar: "Calendar to sync",
  dedicatedCalendar: "Create a dedicated Okorema! calendar",
  syncNow: "Sync now",
  lastSync: "Last sync",
  neverSynced: "Not synced yet",
  syncFailed: "Sync failed",
  conflictPolicy: "If both sides edit the same reminder, the newer timestamp wins per field (title, notes, due, completed, list). Ties stay on this device.",
  tasksLimitation: "Google Tasks stores a date only. The time stays on this device and in a marker at the end of the notes. Tasks cannot edit the time.",
  keepWorkspace: "The Keep API is for Google Workspace organizations. An admin may need to approve the scope. Personal Gmail accounts cannot call it.",
  keepPersonal: "This is a personal Google account. The Keep API is unavailable, so you can hand a note to Keep from the share sheet.",
  keepWorking: "This Workspace account can sync Keep. The API has no update method, so a change recreates the note.",
  shareToKeep: "Share to Keep",
  pro: "Pro",
  proLead: "One-time purchase. Not a subscription. Unlocks Oni mode and place reminders.",
  proPriceNote: "The store price shown by App Store or Google Play is the price. The switch below is for development builds.",
  purchase: "Buy Pro",
  restore: "Restore purchase",
  proUnlocked: "Pro is unlocked",
  proDev: "Unlock Pro for development",
  devUnlock: "Development Pro is on",
  devLock: "Development Pro is off",
  seedDemo: "Load sample data",
  about: "About Okorema!",
  aboutBody: "A local-first reminder that keeps notifying until you are done. No ads and no account.",
  language: "Language",
  languageValue: "English (follows the device)",
  weekCompleted: (count) => `Completed in 7 days: ${count}`,
  overdueCount: (count) => `Overdue: ${count}`,
  noUpcoming: "Nothing else coming up",
  reminderTitlePlaceholder: "What should stick?",
  requiredTitle: "Add a title",
  notifActions: "Notifications include Done and Snooze 10 min.",
  liveActivity: "The next reminder counts down on the Lock Screen and Dynamic Island. Android uses an ongoing countdown notification.",
  widgetHelp: "Home screen widgets show the next reminder, overdue count, today's list, and how many you completed in the last 7 days. That is a count, not a streak.",
  accountFree: "No account",
  noAds: "No ads",
  geofenceProOnly: "Place reminders need Pro",
  persistenceProOnly: "Oni mode needs Pro",
  minutesBefore: (minutes) => `${minutes} min before`,
  deleteListBody: "Reminders inside this list are deleted too.",
  todayEmpty: "Nothing due today",
  completedEmpty: "Nothing completed yet",
  close: "Close",
  continueLabel: "Continue",
  googleCalendar: "Google Calendar",
  googleTasks: "Google Tasks",
  googleKeep: "Google Keep",
  syncing: "Syncing",
  saved: "Saved",
  radiusMeters: (meters) => `${meters} m`,
  placeDistance: (km) => `${km} km`,
  editorLead: "Set the due time, repeat, heads-up, and how persistent it should be.",
  list: "List",
  createListInline: "Name a list and create it",
  noneYet: "Not set",
  systemStatus: "Notifications on this device",
  exactAlarmReady: "Exact alarms are allowed",
  exactAlarmMissing: "Exact alarms are not allowed",
  fullScreenReady: "Full-screen intents are allowed",
  fullScreenMissing: "Full-screen intents are not allowed",
  notifReady: "Notifications are allowed",
  notifMissing: "Notifications are not allowed yet",
  devSection: "Developer",
  expoGoLimits:
    "In Expo Go you can use lists, reminders, repeats, local notifications (Done and Snooze 10 min), the overdue full-screen gate, and backup. Live Activity, home widgets, store purchases, iPhone Reminders import, place monitoring, and this app's own native module need a development build. Use Unlock Pro for development to try Pro.",
  expoGoGoogle:
    "Google sign-in is unavailable in Expo Go. Google does not accept Expo Go's exp:// redirect, and the native Google Sign-In module is not in Expo Go. Use a development build to sync calendars.",
  expoGoPro: "Store purchases are not in Expo Go. Use Unlock Pro for development to try Oni mode and places.",
  expoGoImport: "Expo Go cannot read iPhone Reminders (EventKit). That needs a development build.",
  expoGoWidgets:
    "Live Activity and home widgets do not run in Expo Go. Local notifications still arrive. Time Sensitive delivery depends on Expo Go and may fall back to a normal alert.",
  expoGoGeofence: "Arrive and leave monitoring does not run in Expo Go. The place is saved, but it will not notify you.",
};
