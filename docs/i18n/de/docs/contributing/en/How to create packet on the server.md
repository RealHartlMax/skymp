Der Client sendet viele Pakete an den Server, damit das Spiel funktioniert. Diese Anleitung zeigt, wie ein neuer Pakettyp angelegt und auf dem Server verarbeitet wird.

0. Lege den Namen und die enthaltenen Daten fest. In [MsgType.h](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/mp_common/MsgType.h) findest du die üblichen Namensmuster. Die meisten Nachrichten verwenden JSON. Die [JSON-Beschreibung bei Wikipedia](https://en.wikipedia.org/wiki/JSON) erläutert die Syntax und verfügbaren Datentypen.
1. Ergänze in der Aufzählung in `MsgType.h` einen neuen Pakettyp, beispielsweise `Foo`.
2. Ergänze in `PacketParser.cpp`, Funktion `TransformPacketIntoAction`, den Fall `case MsgType::Foo:`. Lies dort entsprechend den benachbarten Fällen die JSON-Werte in Variablen wie `uint32_t`, `const char *` usw. ein.
3. Ergänze in [ActionListener.h](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/ActionListener.h) und [ActionListener.cpp](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/ActionListener.cpp) eine Methode, die die eingelesenen JSON-Daten erhält. Lass die Implementierung zunächst leer. Rufe die Methode im neuen Fall in `PacketParser.cpp` auf. Der Server ruft sie nun beim Empfang dieses Pakets auf.
4. Implementiere die Methode in `ActionListener.cpp`. Verwende die vorhandenen Serverklassen zur Lösung der Aufgabe und beachte die folgenden Empfehlungen.

Allgemeine Empfehlungen:

1. Vertraue den Paketdaten nicht. Prüfe, ob der Spieler die Aktion tatsächlich ausführen darf. Gehe davon aus, dass böswillige Spieler Zugriff auf den Clientcode haben können; das ist bei diesem Projekt tatsächlich der Fall.
2. Weitere Empfehlungen werden ergänzt.
