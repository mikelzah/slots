// Настройка онлайн-режима «Дурак с другом»
// =========================================
//
// Онлайн-режим синхронизирует партию между двумя браузерами через
// Firebase Realtime Database. Чтобы он заработал, нужен бесплатный
// проект Firebase:
//
//   1. Откройте https://console.firebase.google.com/ и создайте проект.
//   2. В разделе Build → Realtime Database нажмите «Create Database»
//      и выберите режим «Start in test mode» (открытые правила чтения
//      и записи — этого достаточно для игры с другом без регистрации).
//   3. В Project settings → General → Your apps добавьте веб-приложение
//      и скопируйте объект конфигурации SDK.
//   4. Вставьте значения из этого объекта вместо заглушек ниже.
//
// ВНИМАНИЕ: правила «test mode» делают базу полностью открытой на чтение
// и запись — этого достаточно для казуальной игры с другом, но означает,
// что теоретически руку соперника можно прочитать через консоль
// разработчика. Для более серьёзного использования добавьте Firebase
// Auth и security rules, ограничивающие /rooms/{id}/hands/{player}
// доступом только соответствующего игрока.
//
// Без реальных ключей кнопки «Создать комнату» / «Войти» в разделе
// «Дурак с другом» останутся заблокированы, а бот-режим продолжит
// работать как обычно — он не зависит от Firebase.

window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
