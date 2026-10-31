Vom Client gesendete Pakete besitzen ein ganzzahliges Feld `t`, das ihren Typ angibt.

1. Ergänze den Pakettyp in der Aufzählung `MsgType` in `messages.ts`.
2. Nachrichten werden normalerweise in `skympClient.ts` mit `this.sendTarget.send` gesendet. Die Datei enthält viele Beispiele. Suche nach `MsgType` und orientiere dich insbesondere am Versand von `MsgType.Activate`.
