export function steamSessionFromSettings(value: unknown): string | null {
  const token = (value as { steamSession?: unknown } | undefined)?.steamSession;
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function steamAccessMessage(state: string, language: string, id = ''): string {
  const texts: Record<string, Record<string, string>> = {
    de: { pending: 'Deine SteamID wartet auf Freigabe im Server-Dashboard.', blocked: 'Deine SteamID ist auf diesem Server gesperrt.', duplicate: 'Diese SteamID ist bereits auf dem Server angemeldet.', error: 'Die Steam-Anmeldung ist abgelaufen. Bitte über den aktuellen Launcher erneut verbinden.', required: 'Bitte über den aktuellen SkyMP-Worlds-Launcher mit laufendem Steam verbinden.' },
    en: { pending: 'Your Steam ID is waiting for approval in the server dashboard.', blocked: 'Your Steam ID is blocked on this server.', duplicate: 'This Steam ID is already connected to this server.', error: 'Steam authentication expired. Please reconnect through the current launcher.', required: 'Connect through the current SkyMP Worlds launcher with Steam running.' },
    ru: { pending: 'Ваш Steam ID ожидает одобрения в панели сервера.', blocked: 'Ваш Steam ID заблокирован на этом сервере.', duplicate: 'Этот Steam ID уже подключён к серверу.', error: 'Сессия Steam истекла. Подключитесь заново через актуальный лаунчер.', required: 'Подключитесь через актуальный лаунчер SkyMP Worlds с запущенным Steam.' },
    es: { pending: 'Tu Steam ID espera aprobación en el panel del servidor.', blocked: 'Tu Steam ID está bloqueado en este servidor.', duplicate: 'Este Steam ID ya está conectado al servidor.', error: 'La sesión Steam ha caducado. Conecta de nuevo desde el launcher actual.', required: 'Conecta desde el launcher SkyMP Worlds actual con Steam abierto.' },
    fr: { pending: 'Votre Steam ID attend une approbation dans le tableau de bord du serveur.', blocked: 'Votre Steam ID est bloqué sur ce serveur.', duplicate: 'Ce Steam ID est déjà connecté au serveur.', error: 'La session Steam a expiré. Reconnectez-vous depuis le launcher actuel.', required: 'Connectez-vous depuis le launcher SkyMP Worlds actuel avec Steam lancé.' },
    it: { pending: 'Il tuo Steam ID attende l’approvazione nella dashboard del server.', blocked: 'Il tuo Steam ID è bloccato su questo server.', duplicate: 'Questo Steam ID è già connesso al server.', error: 'La sessione Steam è scaduta. Riconnettiti dal launcher aggiornato.', required: 'Connettiti dal launcher SkyMP Worlds aggiornato con Steam aperto.' },
  };
  const selected = texts[language] || texts.en;
  return (selected[state] || selected.error) + (id ? '\n' + id : '');
}
