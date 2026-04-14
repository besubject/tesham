export const CONFIRMATION_MODAL_COPY = {
  completed: {
    title: 'Подтвердить завершение',
    description: 'Отметить запись как завершённую? После этого она перейдёт в завершённые.',
    confirmLabel: 'Завершить запись',
    confirmColor: 'teal',
  },
  cancelled: {
    title: 'Подтвердить отмену',
    description: 'Отменить запись? После этого слот снова станет свободным.',
    confirmLabel: 'Отменить запись',
    confirmColor: 'red',
  },
} as const;
