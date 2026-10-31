[Deutsch](../../../de/docs/release/server_operator_announcement_template.md) · [English](../../../en/docs/release/server_operator_announcement_template.md) · [Русский](server_operator_announcement_template.md)

<a id="server-operator-announcement-template"></a>

# Шаблон объявления для операторов сервера

Используйте шаблон для Discord, форумов или примечаний к выпуску GitHub, предназначенных операторам сервера.

<a id="subject"></a>

## Тема

`[SkyMP] Server update {{VERSION}} ({{RISK_LEVEL}})`

<a id="message"></a>

## Сообщение

Здравствуйте, операторы серверов!

Мы выпустили обновление сервера **{{VERSION}}**.

<a id="1-risk-level"></a>

### 1) Уровень риска

- Уровень: **{{patch|minor|major}}**
- Причина: {{one-line reason}}

<a id="2-what-changed"></a>

### 2) Изменения

- {{change 1}}
- {{change 2}}
- {{change 3}}

<a id="3-required-actions"></a>

### 3) Необходимые действия

- {{none OR explicit migration step}}
- {{config change if needed}}

<a id="4-before-updating-required"></a>

### 4) До обновления (обязательно)

- Сохраните резервную копию `server-settings.json`
- Сохраните `dataDir` (`changeForms`, файлы состояния администратора, скрипты и ресурсы модов)
- Сохраните базу данных/дамп, если используется

<a id="5-maintenance-window"></a>

### 5) Окно обслуживания

- Начало: {{date/time + timezone}}
- Ожидаемый простой: {{minutes}}

<a id="6-rollback-policy"></a>

### 6) Правило отката

При проблемах вернитесь к предыдущему пакету сервера и восстановите резервные копии.

<a id="7-links"></a>

### 7) Ссылки

- Выпуск: {{release URL}}
- Журнал изменений: {{changelog URL}}
- Руководство по обновлению: `docs/docs_server_update_playbook.md`

Спасибо, что поддерживаете серверы SkyMP.
