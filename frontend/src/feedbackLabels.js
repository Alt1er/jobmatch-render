export const CATEGORY = {
  bug: { label: 'Помилка', icon: '🐞' },
  idea: { label: 'Пропозиція', icon: '💡' },
  question: { label: 'Питання', icon: '❓' },
  other: { label: 'Інше', icon: '✉️' },
};

export const PRIORITY = {
  low: 'Низький',
  normal: 'Звичайний',
  high: 'Високий',
  critical: 'Критичний',
};

export const FB_STATUS = {
  new: { label: 'Нове', cls: 'st-new' },
  in_progress: { label: 'В роботі', cls: 'st-progress' },
  resolved: { label: 'Вирішено', cls: 'st-invited' },
  rejected: { label: 'Відхилено', cls: 'st-rejected' },
};

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
