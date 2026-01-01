# Discord Advanced Welcomer Bot

Profesyonel, tamamen özelleştirilebilir ve Railway uyumlu Discord Karşılama Botu.

## 🚀 Özellikler

*   **Oto-Rol:** Yeni gelenlere otomatik rol verme.
*   **Gelişmiş Embed:** Resimli, renkli ve detaylı karşılama mesajları.
*   **Tam Kontrol:** `/welcome` komutu ile kanal, mesaj, dm, ping ayarları.
*   **Kalıcı Veri:** Ayarlar sunucu bazlı saklanır.

## 🛠️ Kurulum (Yerel)

1.  Bu projeyi indirin.
2.  Gerekli modülleri yükleyin:
    ```bash
    npm install
    ```
3.  `.env` dosyasını oluşturun ve bilgilerinizi girin:
    ```env
    TOKEN=BOT_TOKENINIZ
    CLIENT_ID=BOT_ID_NIZ
    ```
4.  Botu başlatın:
    ```bash
    npm start
    ```

## 🚂 Railway Deploy (Canlıya Alma)

Bu proje **Railway** ile tam uyumludur.

1.  Projeyi GitHub'a yükleyin.
    *   *Not: `.env` ve `node_modules` yüklenmemelidir (otomatik engellendi).*
2.  Railway.app üzerinde yeni proje oluşturun ve GitHub reponuzu seçin.
3.  Railway'de projenizin **Variables** (Değişkenler) sekmesine gidin ve şunları ekleyin:
    *   `TOKEN`: Discord Bot Tokenınız.
    *   `CLIENT_ID`: Bot ID'niz.
4.  Railway otomatik olarak `npm start` komutunu algılayacak ve botunuzu başlatacaktır.

## 📝 Komutlar

*   `/welcome channel`
*   `/welcome message`
*   `/welcome embed`
*   `/welcome autorole`
*   `/welcome test`
