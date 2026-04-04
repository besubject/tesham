#!/bin/bash
set -e

TASKS_FILE="tasks.json"

resolve_agent() {
    if [[ -n "${RALPH_AGENT:-}" ]]; then
        echo "$RALPH_AGENT"
        return 0
    fi
    if command -v claude >/dev/null 2>&1; then
        echo "claude"
        return 0
    fi
    if command -v codex >/dev/null 2>&1; then
        echo "codex"
        return 0
    fi
    return 1
}

run_agent() {
    local agent="$1"
    local prompt="$2"
    case "$agent" in
        claude)
            claude --permission-mode acceptEdits -p "$prompt"
            ;;
        codex)
            local output_file
            output_file="$(mktemp -t ralph_codex.XXXXXX)"
            codex exec --full-auto --color never -C "$PWD" --output-last-message "$output_file" "$prompt" >/dev/null
            cat "$output_file"
            rm -f "$output_file"
            ;;
        *)
            echo "Unsupported agent: $agent" >&2
            return 1
            ;;
    esac
}

has_pending_tasks() {
    pending_count=$(grep -c '"status": "pending"' "$TASKS_FILE" 2>/dev/null || echo "0")
    [ "$pending_count" -gt 0 ]
}

iteration=1

while has_pending_tasks; do
    echo ""
    echo "========================================="
    echo "  RALPH — Итерация $iteration"
    echo "========================================="
    pending=$(grep -c '"status": "pending"' "$TASKS_FILE" 2>/dev/null || echo "0")
    done_count=$(grep -c '"status": "done"' "$TASKS_FILE" 2>/dev/null || echo "0")
    echo "  Pending: $pending | Done: $done_count"
    echo "========================================="

    agent=$(resolve_agent) || {
        echo "Агент не найден. Установите claude или codex." >&2
        exit 1
    }

    prompt=$(cat <<'EOF'
@tasks.json @progress.txt

Ты — автономный агент в ральф-цикле. Работай строго по инструкции:

1. Прочитай tasks.json и progress.txt.
2. Найди задачу с наивысшим приоритетом (critical > high > medium > low) и статусом "pending".
   Проверь, что ВСЕ её dependencies имеют статус "done". Если нет — бери следующую.
3. РАБОТАЙ ТОЛЬКО НАД ОДНОЙ ЗАДАЧЕЙ.
4. Имплементируй задачу. Делай git commit после каждого логического изменения.
5. Выполни ВСЕ test_steps из задачи. Запусти линтер и тесты.
6. Если ВСЕ тесты прошли — измени status на "done". Иначе "partial" или "blocked".
7. ДОПИШИ (append, НЕ перезаписывай!) результаты в progress.txt.
   Обязательно укажи какие задачи теперь разблокированы.
8. Сделай финальный git commit.

КРИТИЧНО:
- progress.txt — ТОЛЬКО ДОПИСЫВАТЬ. НИКОГДА не перезаписывать.
- tasks.json — ТОЛЬКО менять status. НИКОГДА не удалять описания.
- ОДНА итерация = ОДНА задача.

Если задача полностью выполнена, выведи <promise>COMPLETE</promise>.
EOF
)

    result=$(run_agent "$agent" "$prompt")
    echo "$result"

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
        echo "✓ TASK выполнен!"
        remaining=$(grep -c '"status": "pending"' "$TASKS_FILE" 2>/dev/null || echo "0")
        if [ "$remaining" -eq 0 ]; then
            echo "🎉 Все задачи выполнены!"
            say -v Milena "Хозяин, я всё сделалъ!" 2>/dev/null || true
            exit 0
        fi
        echo "Осталось задач: $remaining. Продолжаю..."
        say -v Milena "Задача готова. Продолжаю работу." 2>/dev/null || true
    fi

    ((iteration++))
done

echo "🎉 Все задачи выполнены! Итераций: $((iteration-1))"
say -v Milena "Хозяин, я сделалъ!" 2>/dev/null || true
