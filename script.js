document.addEventListener('DOMContentLoaded', () => {
    const dom = {
        viewContainer: document.getElementById('view-container'),
        dateDisplay: document.getElementById('date-display'),
        timerViewTemplate: document.getElementById('timer-view-template'),
        habitsListViewTemplate: document.getElementById('habits-list-view-template'),
        resetDayBtn: document.getElementById('reset-day-btn'),
        addHabitForm: document.getElementById('add-habit-form'),
        habitNameInput: document.getElementById('habit-name-input'),
        habitDurationInput: document.getElementById('habit-duration-input'),
        manageHabitsList: document.getElementById('manage-habits-list'),
        importHabitsBtn: document.getElementById('import-habits-btn'),
        exportHabitsBtn: document.getElementById('export-habits-btn'),
        importFileInput: document.getElementById('import-file-input'),
        alarmSound: document.getElementById('alarm-sound'),
    };

    let state = {
        habits: [],
        completionLog: {},
        timer: { isActive: false, intervalId: null, timeLeft: 0, totalTime: 0, habitId: null },
    };
    const HABITS_KEY = 'finalLayoutHabitTracker_habits_v1';
    const LOG_KEY = 'finalLayoutHabitTracker_log_v1';

    const saveData = () => {
        localStorage.setItem(HABITS_KEY, JSON.stringify(state.habits));
        localStorage.setItem(LOG_KEY, JSON.stringify(state.completionLog));
    };
    const loadData = () => {
        state.habits = JSON.parse(localStorage.getItem(HABITS_KEY)) || [];
        state.completionLog = JSON.parse(localStorage.getItem(LOG_KEY)) || {};
    };

    const getTodayString = () => new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

    const notifyUser = (message) => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        new Notification('习惯打卡提醒', { body: message, icon: 'https://i.imgur.com/4qJmE9r.png' });
    };

    const render = () => {
        state.timer.isActive ? renderTimerView() : renderHabitsListView();
        renderManagementList();
    };

    const renderHabitsListView = () => {
        const view = dom.habitsListViewTemplate.content.cloneNode(true);
        const list = view.querySelector('.habits-list');
        list.innerHTML = '';
        if (state.habits.length === 0) {
            list.innerHTML = '<p style="text-align:center; color: var(--text-secondary); padding: 40px 0;">请在右侧的习惯库中添加您的每日习惯。</p>';
        } else {
            const today = getTodayString();
            state.habits.forEach(habit => {
                const isCompleted = state.completionLog[habit.id] && state.completionLog[habit.id].includes(today);
                const li = document.createElement('li');
                li.className = `habit-item ${isCompleted ? 'completed' : ''}`;
                li.dataset.id = habit.id;
                li.innerHTML = `
                    <div class="habit-info">
                        <div class="habit-name">${habit.name}</div>
                        <div class="habit-duration">${habit.duration} 分钟</div>
                    </div>
                    ${isCompleted
                        ? `<div class="completed-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>`
                        : '<button class="start-habit-btn">开始计时</button>'}
                `;
                list.appendChild(li);
            });
        }
        dom.viewContainer.innerHTML = '';
        dom.viewContainer.appendChild(view);
        dom.viewContainer.querySelector('.habits-list')?.addEventListener('click', handleHabitListClick);
    };

    const renderTimerView = () => {
        const habit = state.habits.find(h => h.id === state.timer.habitId);
        if (!habit) { stopTimer(false); return; }
        const view = dom.timerViewTemplate.content.cloneNode(true);
        view.querySelector('.current-habit-title').textContent = habit.name;
        dom.viewContainer.innerHTML = '';
        dom.viewContainer.appendChild(view);
        dom.viewContainer.querySelector('.stop-btn').addEventListener('click', () => stopTimer(false));
        updateTimerDisplay();
    };

    const renderManagementList = () => {
        dom.manageHabitsList.innerHTML = '';
        if (state.habits.length === 0) {
            dom.manageHabitsList.innerHTML = '<p style="text-align:center; font-size: 14px; color: var(--text-secondary);">暂无习惯</p>';
        } else {
            state.habits.forEach(habit => {
                const li = document.createElement('li');
                li.className = 'manage-habit-item';
                li.dataset.id = habit.id;
                li.innerHTML = `
                    <span>${habit.name} (${habit.duration} 分钟)</span>
                    <button class="delete-habit-btn" title="删除习惯">×</button>
                `;
                dom.manageHabitsList.appendChild(li);
            });
        }
    };

    const startTimer = (habitId) => {
        const habit = state.habits.find(h => h.id === habitId);
        if (!habit || state.timer.isActive) return;
        const durationSeconds = habit.duration * 60;
        state.timer = {
            isActive: true,
            habitId,
            totalTime: durationSeconds,
            timeLeft: durationSeconds,
            intervalId: setInterval(tick, 1000)
        };
        if (dom.alarmSound) {
            dom.alarmSound.muted = true;
            dom.alarmSound.play().then(() => {
                dom.alarmSound.pause();
                dom.alarmSound.muted = false;
                dom.alarmSound.currentTime = 0;
            }).catch(e => {
                console.warn("音频初始化失败：浏览器可能仍然阻止此操作。", e);
            });
        }
        renderTimerView();
        notifyUser(`开始计时：${habit.name}，时长 ${habit.duration} 分钟。`);
    };

    const stopTimer = (isCompleted) => {
        clearInterval(state.timer.intervalId);
        const { habitId } = state.timer;
        const habitName = state.habits.find(h => h.id === habitId)?.name || '';
        state.timer.isActive = false;
        state.timer.intervalId = null;
        if (isCompleted) {
            markHabitAsComplete(habitId);
            if (dom.alarmSound && !dom.alarmSound.muted) {
                dom.alarmSound.currentTime = 0;
                dom.alarmSound.play().catch(e => {
                    console.error("闹钟声音播放失败，请检查浏览器媒体权限设置。", e);
                });
            }
            notifyUser(`恭喜！您已成功完成 "${habitName}" 的计时打卡！`);
        } else {
            notifyUser(`计时已停止：您放弃了 "${habitName}" 的本次计时。`);
        }
        renderHabitsListView();
        document.title = '每日习惯打卡器';
    };

    const tick = () => {
        state.timer.timeLeft--;
        updateTimerDisplay();
        if (state.timer.timeLeft < 0) stopTimer(true);
    };

    const updateTimerDisplay = () => {
        if (!state.timer.isActive) return;
        const { timeLeft, totalTime } = state.timer;
        const remaining = Math.max(0, timeLeft);
        const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
        const seconds = (remaining % 60).toString().padStart(2, '0');
        const timerDisplayEl = dom.viewContainer.querySelector('.timer-display');
        const progressBarEl = dom.viewContainer.querySelector('.progress-bar-inner');
        if (timerDisplayEl) timerDisplayEl.textContent = `${minutes}:${seconds}`;
        if (progressBarEl) {
            const progress = (totalTime - remaining) / totalTime * 100;
            progressBarEl.style.width = `${progress}%`;
        }
        document.title = `${minutes}:${seconds} - 专注中`;
    };

    const markHabitAsComplete = (habitId) => {
        const today = getTodayString();
        if (!state.completionLog[habitId]) state.completionLog[habitId] = [];
        if (!state.completionLog[habitId].includes(today)) {
            state.completionLog[habitId].push(today);
            saveData();
        }
    };

    const resetDailyProgress = () => {
        const today = getTodayString();
        if (confirm(`确定要清除今天（${today}）所有的打卡记录吗？`)) {
            Object.keys(state.completionLog).forEach(habitId => {
                if (state.completionLog[habitId]) {
                    state.completionLog[habitId] = state.completionLog[habitId].filter(date => date !== today);
                }
            });
            saveData();
            render();
            alert('今日打卡记录已清除。');
        }
    };

    const handleHabitListClick = (e) => {
        const startBtn = e.target.closest('.start-habit-btn');
        if (startBtn) {
            if (state.timer.isActive) return alert('请先停止当前计时器！');
            const habitId = startBtn.closest('.habit-item').dataset.id;
            startTimer(habitId);
        }
    };

    dom.resetDayBtn.addEventListener('click', resetDailyProgress);
    dom.addHabitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dom.habitNameInput.value.trim();
        const duration = parseInt(dom.habitDurationInput.value);
        if (name && duration >= 1) {
            const newHabit = {
                id: `habit-${Date.now()}`,
                name,
                duration
            };
            state.habits.push(newHabit);
            saveData();
            render();
            dom.addHabitForm.reset();
            dom.habitNameInput.focus();
        } else {
            alert('请输入有效的习惯名称和至少 1 分钟的时长！');
        }
    });

    dom.manageHabitsList.addEventListener('click', (e) => {
        if (e.target.matches('.delete-habit-btn')) {
            const habitId = e.target.closest('.manage-habit-item').dataset.id;
            if (confirm('删除这个习惯，与之相关的历史打卡记录也会全部清除。确定删除吗？')) {
                state.habits = state.habits.filter(h => h.id !== habitId);
                delete state.completionLog[habitId];
                saveData();
                render();
            }
        }
    });

    dom.exportHabitsBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify({ habits: state.habits, completionLog: state.completionLog }, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `HabitTracker_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    });

    dom.importHabitsBtn.addEventListener('click', () => dom.importFileInput.click());
    dom.importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (!Array.isArray(data.habits) || typeof data.completionLog !== 'object') {
                    throw new Error('文件格式无效或缺失 fields。');
                }
                if (confirm('导入将覆盖所有现有习惯和记录，确定覆盖吗？')) {
                    state.habits = data.habits;
                    state.completionLog = data.completionLog;
                    saveData();
                    render();
                    alert('数据导入成功！');
                }
            } catch (err) {
                alert('导入失败: 文件解析错误或格式不正确。' + (err.message || ''));
            }
            dom.importFileInput.value = '';
        };
        reader.readAsText(file);
    });

    const initialize = () => {
        loadData();
        dom.dateDisplay.textContent = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        render();
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'denied') {
                    console.log("通知权限被拒绝，将无法发送浏览器通知。");
                }
            });
        }
    };

    initialize();
});

const stopTimer = (isCompleted) => {
    clearInterval(state.timer.intervalId);
    const { habitId } = state.timer;
    const habitName = state.habits.find(h => h.id === habitId)?.name || '';
    state.timer.isActive = false;
    state.timer.intervalId = null;
    if (isCompleted) {
        markHabitAsComplete(habitId);
        if (dom.alarmSound && dom.alarmSound.muted === false) {
            dom.alarmSound.currentTime = 0;
            dom.alarmSound.play().then(() => {
                console.log('声音播放成功！');
                notifyUser(`恭喜！您已成功完成 "${habitName}" 的计时打卡！`);
            }).catch(e => {
                console.error('声音播放失败，请检查浏览器媒体权限设置。', e);
            });
        } else {
            notifyUser(`恭喜！您已成功完成 "${habitName}" 的计时打卡！`);
        }
    } else {
        notifyUser(`计时已停止：您放弃了 "${habitName}" 的本次计时。`);
    }
    renderHabitsListView();
    document.title = '每日习惯打卡器';
};

