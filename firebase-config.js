// Настройка онлайн-режима «Дурак с другом»
// =========================================
//
// Онлайн-режим синхронизирует партию между двумя браузерами через
// Firebase Realtime Database.
//
// projectId, apiKey и остальные поля ниже уже заполнены значениями
// проекта amskgames. Осталось только включить саму Realtime Database
// и подставить её адрес в databaseURL:
//
//   1. Откройте https://console.firebase.google.com/project/amskgames/database
//   2. Нажмите «Create Database», выберите регион и режим
//      «Start in test mode» (открытые правила чтения/записи — этого
//      достаточно для игры с другом без авторизации).
//   3. После создания наверху страницы появится адрес базы вида
//      https://amskgames-default-rtdb.europe-west1.firebasedatabase.app
//      — скопируйте его вместо заглушки databaseURL ниже.
//
// ВНИМАНИЕ: правила «test mode» делают базу полностью открытой на чтение
// и запись — этого достаточно для казуальной игры с другом, но означает,
// что теоретически руку соперника можно прочитать через консоль
// разработчика. Для более серьёзного использования добавьте Firebase
// Auth и security rules, ограничивающие /rooms/{id}/hands/{player}
// доступом только соответствующего игрока. Учтите также, что apiKey
// веб-приложения Firebase не является секретом и намеренно виден в
// клиентском коде — доступ к данным ограничивается правилами базы, а не
// секретностью ключа.
//
// Пока databaseURL не заполнен реальным адресом, кнопки «Создать
// комнату» / «Войти» в разделе «Дурак с другом» останутся заблокированы,
// а бот-режим продолжит работать как обычно — он не зависит от Firebase.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBrjXBZulPElN-v3UFUfZUYJAJoz1CfImQ",
  authDomain: "amskgames.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "amskgames",
  storageBucket: "amskgames.firebasestorage.app",
  messagingSenderId: "88619986841",
  appId: "1:88619986841:web:3e5581d26a9751ca91ad08",
};
