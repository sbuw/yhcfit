
document.addEventListener('DOMContentLoaded', () => {
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function checkAccess(moduleName) {
        const premiumModules = ['home', 'plan', 'library', 'schedule'];
        
        if (premiumModules.includes(moduleName)) {
            return userData.is_subscribed;
        }
        return true; 
    }

    let progressChartInstance = null;
    let measureChartInstance = null;

    const mainContent = document.querySelector('.main-content');
    const navLinks = document.querySelectorAll('.nav-links li, .mobile-nav-links li, .nav-item');
    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const logo = document.querySelector('.logo');
    
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

    let trainingPlans = [], sharedPlans = {}, scheduleNotes = {}, userData = {};
    let workoutHistory = []; 
    let currentWorkoutSession = null;
    let dailyStats = {};
    let timerState = { interval: null, seconds: 0, isRunning: false };
    let currentScheduleDate = new Date(); 
    let planToDeleteId = null;

    const defaultUserData = { weight: 85, gender: 'Мужской', prs: { squat: 140, bench: 100, deadlift: 180 }, measurements: [], progress: { labels: ['Янв', 'Фев'], squat: [120, 130], bench: [90, 95], deadlift: [160, 170] }, settings: { accentColor: '#F000B8' } };
    

    function formatWeightDisplay(weight) {
        if (weight == 0 || weight === '0' || weight === '') {
            return `<span style="color: var(--primary-color); font-size: 0.9em; display: inline-flex; align-items: center; gap: 4px;">
                <i class='bx bx-body'></i> Свой вес
            </span>`;
        }

        return `<strong>${weight}</strong>кг`;
    }

    function showNotification(message, type = 'success') {
        
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        
        
        let icon = 'bx-check-circle';
        let borderColor = '#22c55e'; 
        
        if (type === 'error') {
            icon = 'bx-error-circle';
            borderColor = '#ef4444'; 
            toast.style.borderColor = borderColor;
            toast.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 20px ${borderColor}33`;
        }

        toast.innerHTML = `
            <div class="toast-icon" style="color: ${borderColor}"><i class='bx ${icon}'></i></div>
            <div class="toast-message">${message}</div>
        `;

        document.body.appendChild(toast);

        
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        
        setTimeout(() => {
            toast.classList.remove('show');
            
            setTimeout(() => {
                toast.remove();
            }, 400);
        }, 3000);
    }

    
    function saveAllData() {
        console.log("hw)");
    }
    
    async function loadAllData() {
        const loader = document.getElementById('system-loader');
    
        const savedDraft = localStorage.getItem('currentWorkoutSession');
        if (savedDraft) {
            currentWorkoutSession = JSON.parse(savedDraft);
        }

        try {
            const userResp = await fetch('/api/user/');
            if (userResp.status === 403 || userResp.status === 401) {
                window.location.href = '/accounts/login/';
                return;
            }
            if (!userResp.ok) throw new Error('Ошибка при загрузке профиля');
            userData = await userResp.json();

            workoutHistory = userData.workoutHistory || [];

            const plansResp = await fetch('/api/plans/');
            if (!plansResp.ok) throw new Error('Ошибка при загрузке планов');
            trainingPlans = await plansResp.json();

            sharedPlans = JSON.parse(localStorage.getItem('sharedPlans')) || {};

            scheduleNotes = {};
            dailyStats = {};
            if (userData.dailyEntries) {
                for (const [date, val] of Object.entries(userData.dailyEntries)) {
                    scheduleNotes[date] = val.note;
                    dailyStats[date] = { mood: val.mood };
                }
            }

            applyThemeSettings();

            const activeNav = document.querySelector('.nav-item.active, .nav-links li.active');
            const moduleName = activeNav ? activeNav.dataset.module : 'home';

            await loadModule(moduleName);

            setTimeout(() => {
                if (loader) loader.classList.add('hidden');
            }, 500);

        } catch (err) {
            console.error("Ошибка загрузки:", err);
            if (loader) {
                loader.innerHTML = `<div style="color:var(--danger-color); font-family:var(--font-display);">SYSTEM_ERROR: CONNECTION_FAILED</div>`;
            }
        }
    }

    function applyThemeSettings() {
        
        const color = userData.accentColor || (userData.settings && userData.settings.accentColor);
        
        if (color) {
            document.documentElement.style.setProperty('--primary-color', color);
        }
    }

    function createModernExerciseHTML(name = '', sets = '', reps = '', weight = '') {
        return `
        <div class="editor-card-tech">
            <!-- Название упражнения сверху -->
            <div class="tech-name-input-group">
                <label>Упражнение</label>
                <input type="text" class="tech-input inp-name" value="${name}" placeholder="Название...">
            </div>
            
            <!-- Параметры в один ряд снизу -->
            <div class="tech-stats-row">
                <div class="tech-input-group">
                    <label>Подх.</label>
                    <input type="number" class="tech-input inp-sets" value="${sets}" placeholder="0">
                </div>
                <div class="tech-input-group">
                    <label>Повт.</label>
                    <input type="text" class="tech-input inp-reps" value="${reps}" placeholder="0">
                </div>
                <div class="tech-input-group">
                    <label>КГ</label>
                    <input type="text" class="tech-input inp-weight" value="${weight}" placeholder="0">
                </div>
                
                <!-- Кнопка удаления в конце ряда -->
                <button type="button" class="btn-tech-remove" title="Удалить">
                    <i class='bx bx-x'></i>
                </button>
            </div>
        </div>`;
    }

    function getMonthlyVolume() {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return workoutHistory.reduce((sum, session) => {
            const sessionDate = new Date(session.date);
            if (sessionDate.getMonth() === currentMonth && sessionDate.getFullYear() === currentYear) {
                return sum + (session.totalVolume || 0);
            }
            return sum;
        }, 0);
    }

   
    const renderHome = () => {
        const today = new Date(); const dayName = daysOfWeek[(today.getDay() + 6) % 7]; const activePlan = trainingPlans.find(p => p.active); const workout = activePlan?.schedule?.[dayName] ?? [];
        const todayKey = new Date().toISOString().split('T')[0];

        const now = new Date();
        const dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        let workoutContent = '';
        if (currentWorkoutSession) {
            const sessionDateKey = currentWorkoutSession.date.split('T')[0];
            const isToday = sessionDateKey === todayKey;

            if (isToday) {
                
                workoutContent = `
                <div class="card col-span-12 active-workout-card">
                    <h2 class="card-title" style="color: var(--primary-color);">🔥 Тренировка в процессе</h2>
                    <p style="margin-bottom: 1.5rem;">Выполняется: <strong>${currentWorkoutSession.planName}</strong></p>
                    <button class="btn btn-primary" id="continue-workout-btn" style="width: 100%;">Продолжить</button>
                </div>`;
            } else {
       
                workoutContent = `
                <div class="card col-span-12" style="border-color: var(--text-secondary);">
                    <h2 class="card-title">Незавершенная сессия</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Осталась запись за ${new Date(currentWorkoutSession.date).toLocaleDateString()}. Начать новую или дописать старую?
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <button class="btn" id="continue-workout-btn">Дописать</button>
                        <button class="btn btn-danger" id="discard-session-btn">Новая</button>
                    </div>
                </div>`;
            }
        } else {
            if (workout.length > 0) { 
                let workoutListHTML = workout.map(ex => `<li class="workout-item"><span class="workout-item-name">${ex.name}</span><span class="workout-details">${ex.sets}x${ex.reps} · ${ex.weight} кг</span></li>`).join(''); 
                workoutContent = `<div class="card col-span-12"><i class='bx bx-dumbbell bento-icon'></i><h2 class="card-title">Сегодня в фокусе</h2><p style="font-size: 1.2rem; margin-bottom: 1rem;"><strong>${dayName}:</strong> ${activePlan.name}</p><ul class="today-workout-list">${workoutListHTML}</ul><a href="#" class="btn btn-primary" id="start-workout-btn" style="width: 100%;">Начать тренировку</a></div>`; 
            } else { 
                workoutContent = `<div class="card col-span-12"><i class='bx bx-coffee bento-icon'></i><h2 class="card-title">Сегодня</h2><div class="big-data" style="font-size: 3rem;">Отдых</div><p style="color: var(--text-secondary);">Восстанавливай силы.</p></div>`; 
            }
        }
        const workoutsDone = getWeeklyProgress(); const weeklyGoal = 4; const progressPercent = Math.min((workoutsDone / weeklyGoal) * 100, 100);
        const goalCard = `<div class="card col-span-6 goal-bento"><i class='bx bx-target-lock bento-icon'></i><h2 class="card-title">Цель на неделю</h2><div class="big-data">${workoutsDone}<span>/${weeklyGoal}</span></div><div class="progress-container"><div class="progress-bar" style="width: ${progressPercent}%"></div></div></div>`;

        const rmCard = `<div class="card col-span-6"><i class='bx bx-line-chart bento-icon'></i><h2 class="card-title">Калькулятор 1ПМ</h2><div class="rm-inputs" style="margin-top: auto;"><input type="number" id="rm-weight-input" placeholder="Вес"><input type="number" id="rm-reps-input" placeholder="Повторы"></div><button class="btn btn-primary" id="calc-rm-btn" style="margin-top: 0.5rem; width: 100%;">Считать</button></div>`;

        const monthlyVolume = getMonthlyVolume();
        const volumeInTons = (monthlyVolume / 1000).toFixed(1);

        const volumeCard = `
        <div class="card col-span-6" style="justify-content: space-between; position: relative; overflow: hidden;">
            <i class='bx bx-trending-up bento-icon'></i>
            <h2 class="card-title">Объем за месяц</h2>
            
            <div style="z-index: 2;">
                <div class="big-data" style="font-size: 3.5rem; line-height: 1;">
                    ${volumeInTons}<span style="font-size: 0.4em; color: var(--primary-color); margin-left: 5px; font-weight: 900;">ТОНН</span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 5px;">
                    Силовая нагрузка системы
                </p>
            </div>
        </div>
        `;

        const timerCard = `<div class="card col-span-6"><i class='bx bx-time-five bento-icon'></i><h2 class="card-title">Таймер</h2><div class="timer-display" id="timer-display">${formatTime(timerState.seconds)}</div><div class="timer-controls"><button class="btn" id="timer-add-30">+30</button><button class="btn" id="timer-add-60">+1м</button><button class="btn btn-primary" id="timer-toggle">${timerState.isRunning ? 'II' : '▶'}</button><button class="btn btn-danger" id="timer-reset">↻</button></div></div>`;

        const broCard = `<div class="card col-span-6 bro-quote-card"><h2 class="card-title" style="color: #fff;">Бро Саенс</h2><p class="bro-quote-text">"${getBroQuote()}"</p></div>`;

        const horoscopeCard = `<div class="card col-span-12"><i class='bx bx-star bento-icon'></i><h2 class="card-title">Гороскоп</h2><p class="horoscope-text">${getHoroscope()}</p></div>`;

        return `
        <div class="home-hero-compact">
            <div class="hero-status-line">
                <span class="status-badge"><span class="status-dot"></span> SYSTEM_ACTIVE</span>
                <span class="hero-version">V.1.0.1</span>
            </div>
            
            <h1 class="hero-main-title">YHC // <span class="highlight">CORE_LOG</span></h1>
            
            <div class="hero-data-row">
                <div class="data-item">
                    <span class="data-label">TIMESTAMP</span>
                    <span class="data-value">${dateStr} // ${timeStr}</span>
                </div>
                <div class="data-item">
                    <span class="data-label">OPERATOR</span>
                    <span class="data-value">${userData.username || 'ADMIN'}</span>
                </div>
            </div>
        </div>

        <div class="grid">
            ${workoutContent}
            ${volumeCard}
            ${timerCard}
            ${rmCard}
            ${broCard}
            ${horoscopeCard}
        </div>
        `;
    };

    
    function renderPlan() {
        let html = `<h1 class="page-header">Мои планы</h1>
                    <div class="plan-main-actions">
                        <a href="#" class="btn btn-primary" id="create-plan-btn"><i class='bx bx-plus'></i> Новый план</a>
                        <a href="#" class="btn" id="import-plan-btn"><i class='bx bx-import'></i> Импорт</a>
                    </div>`;
        
        const activePlan = trainingPlans.find(p => p.active);
        const activeIndex = trainingPlans.findIndex(p => p.active);

  
        if (activePlan) {
            const daysCount = Object.keys(activePlan.schedule || {}).length;
            
            html += `
                <div class="card col-span-12 active-plan-hero" style="margin-bottom: 2rem;">
                    <div class="plan-content-wrapper">
                        <div>
                            <span class="active-label">АКТИВНЫЙ ПЛАН</span>
                            <h2 class="plan-title-large">${activePlan.name}</h2>
                            <p class="plan-desc">Тренировок в неделю: ${daysCount}</p>
                        </div>
                        <div class="plan-actions">
                            <button class="btn" data-plan-index="${activeIndex}" name="edit-plan">Редактировать</button>
                            <button class="btn" data-plan-index="${activeIndex}" name="export-plan">Поделиться</button>
                        </div>
                    </div>
                    <i class='bx bx-certification bento-icon' style="opacity: 0.1; font-size: 15rem; right: -40px; bottom: -40px;"></i>
                </div>`;
        }

       
        html += `<div class="plans-grid">`;
        
        trainingPlans.forEach((plan, index) => {
           
            if (plan.active) return;

            const daysCount = Object.keys(plan.schedule || {}).length;
            
            html += `
                <div class="plan-card-modern">
                    <div class="plan-info">
                        <h3>${plan.name}</h3>
                        <div class="plan-meta">
                            <span><i class='bx bx-calendar'></i> ${daysCount} дн.</span>
                            <span><i class='bx bx-dumbbell'></i> Силовой</span>
                        </div>
                    </div>
                    <div class="plan-footer">
                        <button class="btn btn-primary btn-block" data-plan-index="${index}" name="activate-plan" style="flex-grow:1;">Выбрать</button>
                        <button class="btn btn-icon" data-plan-index="${index}" name="edit-plan"><i class='bx bx-pencil'></i></button>
                        <button class="btn btn-icon btn-danger" data-plan-index="${index}" name="delete-plan"><i class='bx bx-trash'></i></button>
                    </div>
                </div>`;
        });
        
        html += `</div>`; 
        
      
        if (trainingPlans.length === 0) {
            html += `<div class="card col-span-12" style="text-align:center; padding: 3rem; border-style: dashed; opacity: 0.5;"><p>Список планов пуст. Создайте свой первый!</p></div>`;
        }

        return html;
    }

   
    const renderSchedule = () => {
        
        const date = currentScheduleDate; 
        
        const year = date.getFullYear(); 
        const month = date.getMonth(); 
        
        const firstDay = new Date(year, month, 1); 
        const lastDay = new Date(year, month + 1, 0); 
        
        
        const firstDayOfWeek = (firstDay.getDay() + 6) % 7; 
        
        const activePlan = trainingPlans.find(p => p.active);
        
        
        const dayLabels = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
        let calendarGridHTML = dayLabels.map(d => `<div class="calendar-day-name">${d}</div>`).join('');
        
        
        for (let i = 0; i < firstDayOfWeek; i++) calendarGridHTML += `<div></div>`;
        
        
        for (let i = 1; i <= lastDay.getDate(); i++) {
            
            const currentDate = new Date(year, month, i);
            
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            
            const dayName = daysOfWeek[(currentDate.getDay() + 6) % 7];
            
            
            const historyEntry = workoutHistory.find(h => {
                const hDate = new Date(h.date);
                return hDate.getFullYear() === year && hDate.getMonth() === month && hDate.getDate() === i;
            });

            const isPlanned = activePlan?.schedule?.[dayName]?.length > 0;
            const isToday = new Date().toDateString() === currentDate.toDateString();
            
            let classes = 'calendar-date';
            if (isToday) classes += ' is-today';
            if (historyEntry) classes += ' history-completed';
            else if (isPlanned) classes += ' has-workout';
            
            calendarGridHTML += `<div class="${classes}" data-date="${currentDate.toISOString()}">${i}</div>`;
        }
        
        const workoutsThisMonth = workoutHistory.filter(h => {
            const d = new Date(h.date);
            return d.getMonth() === month && d.getFullYear() === year;
        }).length;

        return `
        <h1 class="page-header">Дневник</h1>
        <div class="schedule-layout">
            <aside class="schedule-sidebar">
                <div class="calendar-wrapper">
                    <!-- ОБНОВЛЕННАЯ ШАПКА С КНОПКАМИ -->
                    <div class="calendar-header">
                        <button class="calendar-nav-btn" id="prev-month-btn"><i class='bx bx-chevron-left'></i></button>
                        <h3>${monthNames[month]} ${year}</h3>
                        <button class="calendar-nav-btn" id="next-month-btn"><i class='bx bx-chevron-right'></i></button>
                    </div>
                    
                    <div class="calendar-grid">${calendarGridHTML}</div>
                </div>
                
                <div class="mood-tracker-card" id="mood-tracker-widget">
                    <h3 class="card-title">Самочувствие</h3>
                    <div class="mood-options">
                        <button class="mood-btn" data-mood="fire">🔥</button>
                        <button class="mood-btn" data-mood="happy">😊</button>
                        <button class="mood-btn" data-mood="tired">😴</button>
                        <button class="mood-btn" data-mood="sick">🤢</button>
                    </div>
                </div>
                
                <div class="month-stats">
                    <div class="mini-stat"><strong>${workoutsThisMonth}</strong><span>Тренировок</span></div>
                    <div class="mini-stat"><strong>${userData.weight}</strong><span>Тек. вес</span></div>
                </div>
            </aside>
            <div id="day-details" class="day-content-wrapper"></div>
        </div>`;
    };

    function showWorkoutForDate(dateStr) {
        const date = new Date(dateStr);
        
        
        const toLocalKey = (d) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
        };

        const dateKey = toLocalKey(date);
        const todayKey = toLocalKey(new Date());
        const dayName = daysOfWeek[(date.getDay() + 6) % 7];
        
        
        document.querySelectorAll('.calendar-date.selected').forEach(el => el.classList.remove('selected'));
        const calendarDates = document.querySelectorAll('.calendar-date');
        calendarDates.forEach(el => {
            if (toLocalKey(new Date(el.dataset.date)) === dateKey) {
                el.classList.add('selected');
            }
        });
        
        updateMoodWidget(dateKey);

        const detailsContainer = document.getElementById('day-details');
        
       
        let html = `
            <div class="day-header-card">
                <i class='bx bx-calendar day-header-bg-icon'></i>
                <h2 style="text-transform: capitalize;">${dayName}</h2>
                <p>${date.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'})}</p>
            </div>`;
        
        
        const historyEntries = workoutHistory.filter(h => {
            return toLocalKey(new Date(h.date)) === dateKey;
        });
        
        if (historyEntries.length > 0) {
            
             html += `<div class="history-feed">`;
             
             historyEntries.forEach((session, idx) => {
                 const time = new Date(session.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                 
              
                 let totalVol = 0;
                 let totalSets = 0;
                 session.exercises.forEach(ex => {
                     ex.performed_sets.forEach(s => {
                         totalVol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
                         totalSets++;
                     });
                 });

             
                 html += `
                 <div class="history-card">
                    <div class="hc-header">
                        <div class="hc-title">
                            <i class='bx bx-check-circle' style="color: var(--primary-color);"></i>
                            ${session.planName || 'Тренировка'}
                        </div>
                        <div class="hc-time">${time}</div>
                    </div>
                    
                    <div class="hc-stats-row">
                        <div class="hc-stat-item">
                            <span class="hc-stat-label">Объем</span>
                            <span class="hc-stat-value">${(totalVol / 1000).toFixed(1)} т</span>
                        </div>
                        <div class="hc-stat-item">
                            <span class="hc-stat-label">Подходы</span>
                            <span class="hc-stat-value">${totalSets}</span>
                        </div>
                        <div class="hc-stat-item">
                            <span class="hc-stat-label">Упражнения</span>
                            <span class="hc-stat-value">${session.exercises.length}</span>
                        </div>
                    </div>

                    <div class="hc-exercises-list">`;

               
                 session.exercises.forEach(ex => {
                     html += `
                        <div class="hc-exercise-row">
                            <div class="hc-ex-name">${ex.name}</div>
                            <div class="hc-sets-container">
                                ${ex.performed_sets.length 
                                    ? ex.performed_sets.map(s => 
                                        `<div class="hc-set-pill">
                                            ${formatWeightDisplay(s.weight)} × <strong>${s.reps}</strong>
                                        </div>`).join('') 
                                    : '<span class="hc-empty-text">Нет подходов</span>'}
                            </div>
                        </div>`;
                 });

                 html += `</div></div>`; 
             });
             html += `</div>`;

        } else if (dateKey < todayKey) {
            
            html += `
                <div class="card" style="border-style: dashed; border-color: var(--border-color); background: transparent; opacity: 0.6;">
                    <h3 class="card-title">ИСТОРИЯ ПУСТА</h3>
                    <p>Записей нет.</p>
                </div>`;

        } else {
            
            const plan = trainingPlans.find(p=>p.active)?.schedule?.[dayName] || [];
            
            if (plan.length > 0) {
                let listHTML = plan.map(ex => `
                    <div class="workout-item" style="margin-bottom: 0.5rem;">
                        <div class="workout-item-name">${ex.name}</div>
                        <div class="workout-details">${ex.sets}x${ex.reps} · ${ex.weight} кг</div>
                    </div>
                `).join('');

                html += `
                <div class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 class="card-title" style="margin: 0;">ПЛАН НА ДЕНЬ</h3>
                        <span style="font-size: 0.8rem; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px;">${plan.length} упр.</span>
                    </div>
                    <div class="plan-preview-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${listHTML}
                    </div>
                </div>`;
            } else {
                 html += `
                 <div class="card" style="border-style: dashed; opacity: 0.6; text-align: center; padding: 3rem;">
                    <i class='bx bx-coffee' style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-secondary);"></i>
                    <h3 class="card-title" style="margin: 0;">ОТДЫХ</h3>
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">Восстанавливай силы.</p>
                 </div>`;
            }
        }
        
        
        const note = scheduleNotes[dateKey] || '';
        html += `
            <div class="card" style="margin-top: 1.5rem;">
                <h2 class="card-title">ЗАМЕТКИ</h2>
                <textarea id="note-textarea" placeholder="Как самочувствие?" style="background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; min-height: 100px; color: var(--text-primary); font-family: var(--font-sans); resize: vertical;">${note}</textarea>
                <div style="display:flex; justify-content: flex-end; margin-top: 1rem;">
                    <button class="btn" id="save-note-btn" data-date-key="${dateKey}">Сохранить заметку</button>
                </div>
            </div>`;
        
        detailsContainer.innerHTML = html;
    }

    function updateMoodWidget(dateKey) { const widget = document.getElementById('mood-tracker-widget'); if (!widget) return; widget.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('active')); if (dailyStats[dateKey] && dailyStats[dateKey].mood) { const btn = widget.querySelector(`.mood-btn[data-mood="${dailyStats[dateKey].mood}"]`); if (btn) btn.classList.add('active'); } widget.dataset.currentDateKey = dateKey; }

    
    let libraryPlans = []; 

    async function renderLibrary() {
        
        if (libraryPlans.length === 0) {
            const resp = await fetch('/api/library/');
            libraryPlans = await resp.json();
        }

        let html = `<h1 class="page-header">Библиотека</h1><div class="library-grid">`;
        libraryPlans.forEach((plan, index) => {
            html += `
            <div class="lib-card-cyber" data-library-index="${index}">
                <div class="lcc-cover">
                    <div class="lcc-icon-box"><i class='bx ${plan.icon}'></i></div>
                </div>
                <div class="lcc-body">
                    <h3 class="lcc-title">${plan.name}</h3>
                    <p class="lcc-desc">${plan.description}</p>
                    <div class="lcc-specs">
                        <div class="lcc-spec-item"><span class="lcc-spec-label">Дни</span><span class="lcc-spec-val">${plan.days}</span></div>
                        <div class="lcc-spec-item"><span class="lcc-spec-label">Уровень</span><span class="lcc-spec-val">${plan.level}</span></div>
                    </div>
                    <div class="lcc-arrow"><i class='bx bx-right-arrow-alt'></i></div>
                </div>
            </div>`;
        });
        html += `</div>`;
        return html;
    }

    const renderProfile = () => {
        if (!userData.progress) {
            userData.progress = { 
                labels: ['Нет данных'], 
                squat: [0], bench: [0], deadlift: [0] 
            };
        }
        const latestMeasurement = userData.measurements.length > 0 ? userData.measurements[userData.measurements.length - 1].measurements : {};
        
        const squat = userData.prs.squat || 0;
        const bench = userData.prs.bench || 0;
        const deadlift = userData.prs.deadlift || 0;
        const totalPower = squat + bench + deadlift;

        const totalWorkouts = workoutHistory.length;
        let rankName = "Новичок";
        let rankIcon = "bx-medal";
        if (totalWorkouts > 10) { rankName = "Любитель"; rankIcon = "bx-run"; }
        if (totalWorkouts > 50) { rankName = "Атлет"; rankIcon = "bx-dumbbell"; }
        if (totalWorkouts > 100) { rankName = "Элита"; rankIcon = "bx-crown"; }
        if (totalWorkouts > 200) { rankName = "Легенда"; rankIcon = "bx-trophy"; }

        const colors = ['#F000B8', '#22c55e', '#3b82f6', '#f97316', '#ef4444', '#8b5cf6'];
        const colorSwatches = colors.map(color => {
            
            const currentAccent = userData.accentColor || '#F000B8';
            const isActive = color.toLowerCase() === currentAccent.toLowerCase();
            
            return `<div class="color-swatch ${isActive ? 'active' : ''}" style="background-color: ${color};" data-color="${color}"></div>`;
        }).join('');

        const subBadge = userData.is_subscribed 
            ? `<div class="rank-badge" style="border-color: #22c55e44; color: #22c55e;">
                <i class='bx bx-check-shield'></i> 
                <span>Доступ до ${new Date(userData.subscription_end).toLocaleDateString()}</span>
            </div>`
            : `<div class="rank-badge" style="border-color: var(--danger-color); color: var(--danger-color); background: rgba(255,0,0,0.05);">
                <i class='bx bx-shield-x'></i> <span>Доступ: Ограничен</span>
            </div>`;

        const statusColor = userData.is_subscribed ? '#22c55e' : 'var(--danger-color)';
        const statusText = userData.is_subscribed 
            ? `АКТИВНА ДО ${new Date(userData.subscription_end).toLocaleDateString()}` 
            : 'ДОСТУП ОГРАНИЧЕН';
        
        const hasProgressData = userData.progress && userData.progress.labels && userData.progress.labels.length > 0;
        const hasMeasureData = userData.measurements && userData.measurements.length > 0;
        
        return `
        <h1 class="page-header">Профиль</h1>
        
        <div class="profile-hero">
            <!-- 1. Аватарка -->
            <div class="profile-avatar-placeholder">
                ${(userData.gender === 'M' ? 'M' : 'W').toUpperCase()}
            </div>
            
            <!-- 2. Инфо (Имя + Бейджи) -->
            <div class="profile-info">
                <h2 class="profile-name">${userData.username || 'Атлет'}</h2>
                <div class="profile-badges">
                    <div class="rank-badge">
                        <i class='bx ${rankIcon}'></i> 
                        <span>${rankName} • ${totalWorkouts} Трен.</span>
                    </div>
                    ${subBadge}
                </div>
            </div>

            <!-- 3. Кнопка-карандаш (Возвращена на место) -->
            <button class="btn" id="edit-profile-btn" style="background: rgba(255,255,255,0.05); border:none;">
                <i class='bx bx-pencil'></i>
            </button>
        </div>

        <!-- POWER GRID -->
        <h2 class="section-title">Силовые показатели</h2>
        <div class="grid">
            <!-- TOTAL CARD -->
            <div class="card col-span-6 total-power-card" style="min-height: 200px; justify-content: center;">
                <!-- GREEN STYLE -->
                <div class="label-style">Сумма троеборья</div>
                
                <div class="stat-value-huge">
                    ${totalPower}<span class="unit-style">кг</span> <!-- RED STYLE -->
                </div>
                <i class='bx bx-trophy bento-icon' style="opacity: 0.1; font-size: 8rem;"></i>
            </div>

            <!-- SBD CARDS -->
            <div class="col-span-6" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="card" style="justify-content: center; align-items: center; text-align: center;">
                    <!-- GREEN STYLE -->
                    <div class="label-style">Присед</div>
                    <div style="font-size: 1.8rem; font-weight: 900; font-family: var(--font-display);">${squat}</div>
                </div>
                <div class="card" style="justify-content: center; align-items: center; text-align: center;">
                    <!-- GREEN STYLE -->
                    <div class="label-style">Жим</div>
                    <div style="font-size: 1.8rem; font-weight: 900; font-family: var(--font-display);">${bench}</div>
                </div>
                <div class="card col-span-2" style="grid-column: span 2; display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                    <div>
                        <!-- GREEN STYLE -->
                        <div class="label-style">Становая</div>
                        <div style="font-size: 1.8rem; font-weight: 900; font-family: var(--font-display);">${deadlift}</div>
                    </div>
                    <i class='bx bx-up-arrow-alt' style="font-size: 2rem; color: var(--primary-color);"></i>
                </div>
            </div>
            
            <div class="col-span-12"><button class="btn" id="edit-prs-btn" style="width: 100%;">Обновить максимумы</button></div>
        </div>

        <!-- BODY PARAMS -->
        <h2 class="section-title">Параметры тела</h2>
        <div class="grid">
            <!-- WEIGHT CARD -->
            <div class="card col-span-4" style="justify-content: space-between;">
                <!-- GREEN STYLE -->
                <div class="label-style">Вес тела</div>
                
                <div style="display: flex; align-items: baseline;">
                    <span style="font-family: var(--font-display); font-size: 3.5rem; font-weight: 900; color: var(--text-primary); line-height: 1;">${userData.weight}</span>
                    <span class="unit-style" style="font-size: 1.5rem;">кг</span> <!-- RED STYLE -->
                </div>
            </div>

             <!-- MEASUREMENTS CARD -->
             <div class="card col-span-8">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                    <div class="label-style" style="margin:0;">Антропометрия</div>
                    <button class="btn" id="add-measurement-btn">+ Обновить</button>
                </div>
                
                <div class="measurements-grid">
                    <div class="mini-stat-box">
                        <span class="label-style" style="font-size: 0.6rem;">Грудь</span>
                        <div>${userData.measurements.length > 0 ? userData.measurements[userData.measurements.length-1].measurements.chest : '-'}</div>
                    </div>
                    <div class="mini-stat-box">
                        <span class="label-style" style="font-size: 0.6rem;">Талия</span>
                        <div>${userData.measurements.length > 0 ? userData.measurements[userData.measurements.length-1].measurements.waist : '-'}</div>
                    </div>
                    <div class="mini-stat-box">
                        <span class="label-style" style="font-size: 0.6rem;">Бедра</span>
                        <div>${userData.measurements.length > 0 ? userData.measurements[userData.measurements.length-1].measurements.hips : '-'}</div>
                    </div>
                    <div class="mini-stat-box">
                        <span class="label-style" style="font-size: 0.6rem;">Бицепс</span>
                        <div>${userData.measurements.length > 0 ? userData.measurements[userData.measurements.length-1].measurements.biceps : '-'}</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- CHARTS & SETTINGS -->
        <h2 class="section-title">Аналитика прогресса</h2>
        <div class="grid">
            <div class="card col-span-12">
                <div class="chart-header"><h3>Прогресс в весах</h3><i class='bx bx-line-chart' style="color: var(--primary-color);"></i></div>
                <div class="chart-container" style="height: 300px;">
                    ${hasProgressData ? '<canvas id="progressChart"></canvas>' : '<div class="chart-empty-placeholder"><i class="bx bx-pulse"></i><p>Нет данных для графика весов</p></div>'}
                </div>
            </div>
            <div class="card col-span-12">
                <div class="chart-header"><h3>Динамика замеров</h3><i class='bx bx-ruler' style="color: var(--primary-color);"></i></div>
                <div class="chart-container" style="height: 300px;">
                    ${hasMeasureData ? '<canvas id="measurementsChart"></canvas>' : '<div class="chart-empty-placeholder"><i class="bx bx-ruler"></i><p>Нет данных для графика замеров</p></div>'}
                </div>
            </div>
        </div>
        <h2 class="section-title" style="margin-top: 3rem;">Система</h2>
        <div class="card" style="gap: 1.5rem;">
            <div style="text-align: center;">
                <div class="label-style">Цветовая схема</div>
                <div class="theme-selector-container">${colorSwatches}</div>
            </div>
            
            <div style="border-top: 1px solid var(--border-color); padding-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">      
                <!-- КНОПКА ВЫХОДА -->
                <form action="/accounts/logout/" method="post">
                    <input type="hidden" name="csrfmiddlewaretoken" value="${getCookie('csrftoken')}">
                    <button type="submit" class="btn btn-danger" style="width: 100%;">
                        ВЫЙТИ ИЗ АККАУНТА
                    </button>
                </form>
            </div>
        </div>
        `;
    };
    
    const renderWorkoutMode = (exerciseNameToShow = null) => {
        if (!currentWorkoutSession) return;
        
        if (exerciseNameToShow) {
            mainContent.innerHTML = renderExerciseDetailView(exerciseNameToShow);
            return;
        }

        
        const planName = currentWorkoutSession.planName;
        
        const marqueeContent = Array(6).fill(0).map((_, i) => {
            const isFilled = i % 2 === 1;
            return `<span class="marquee-text ${isFilled ? 'filled' : ''}">${planName}</span> <span class="marquee-text">•</span>`;
        }).join(' ');

        let content = `
        <!-- НОВЫЙ ХЕДЕР: MARQUEE -->
        <div class="marquee-wrapper">
            <div class="marquee-track">
                <!-- Дублируем контент дважды для бесшовной анимации -->
                ${marqueeContent} ${marqueeContent}
            </div>
        </div>
        `;

        
        currentWorkoutSession.exercises.forEach((ex, index) => {
            const setsDone = ex.performed_sets.length;
            const isStarted = setsDone > 0;
            const plannedSets = parseInt(ex.planned_target.split('x')[0]) || 3; 
            const progressWidth = Math.min((setsDone / plannedSets) * 100, 100);

            content += `
            <div class="workout-card-modern ${isStarted ? 'active' : ''}" data-exercise-name="${ex.name}">
                <div class="wc-header">
                    <span class="wc-number">${String(index + 1).padStart(2, '0')}</span>
                    <span class="wc-status ${isStarted ? 'done' : 'pending'}">
                        ${isStarted ? 'В процессе' : 'Ожидает'}
                    </span>
                </div>
                
                <div class="wc-title">${ex.name}</div>
                
                <div class="wc-meta">
                    <span><i class='bx bx-target-lock'></i> План: ${ex.planned_target}</span>
                    <span><i class='bx bx-check-circle'></i> Сделано: ${setsDone}</span>
                </div>

                <div class="wc-progress-track">
                    <div class="wc-progress-fill" style="width: ${progressWidth}%"></div>
                </div>
            </div>`;
        });

        content += `
        <div class="plan-actions" style="margin-top: 3rem; margin-bottom: 5rem;">
            <button class="btn btn-dashed" id="add-exercise-to-session-btn" style="flex:1; border: 2px dashed var(--border-color); color: var(--text-secondary); padding: 1rem;">
                + Упр.
            </button>
            <button class="btn btn-danger" id="end-workout-btn" style="flex:1;">
                Завершить
            </button>
        </div>`;

        mainContent.innerHTML = content;
    };

    
    function simulateHeartRate() {
        const bpmElement = document.getElementById('live-bpm');
        if (!bpmElement) return;

        
        
        const update = () => {
            const el = document.getElementById('live-bpm');
            if (!el) return; 
            
            
            const randomBPM = Math.floor(Math.random() * (132 - 118 + 1) + 118);
            el.textContent = randomBPM;
            
            
            setTimeout(update, Math.random() * 2000 + 1000);
        };
        
        update();
    }

    function startSessionTimer() {
        
    }

    function renderSubscriptionWall() {
        return `
        <div class="app-container" style="animation: fadeIn 0.6s ease;">
            <div class="main-content" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 70vh;">
                
                <!-- Заголовок в твоем фирменном стиле -->
                <h1 class="hero-title" style="text-align: center; margin-bottom: 2rem;">
                    <span>ACCESS</span>
                    <span class="highlight" style="color: var(--danger-color);">DENIED</span>
                </h1>

                <!-- Блок с инструкцией -->
                <div class="card" style="max-width: 450px; border-color: var(--border-color); background: rgba(255,255,255,0.01); padding: 2.5rem; position: relative; text-align: center;">
                    
                    <!-- Технические уголки (твой стиль) -->
                    <div class="tech-corner tc-tl"></div>
                    <div class="tech-corner tc-tr"></div>
                    <div class="tech-corner tc-bl"></div>
                    <div class="tech-corner tc-br"></div>

                    <div style="margin-bottom: 2rem;">
                        <p style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6; margin: 0;">
                            Ваша лицензия неактивна. Доступ к базе упражнений и дневнику тренировок заблокирован. Для продления доступа обратитесь к администратору.
                        </p>
                    </div>

                    <!-- Контакт как системная строка -->
                    <div style="background: var(--bg-color); border: 1px solid var(--border-color); padding: 1rem; border-radius: 12px; display: inline-block; width: 100%;">
                        <div style="font-family: var(--font-display); font-size: 0.65rem; color: var(--danger-color); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px; opacity: 0.8;">
                            Direct Contact Required
                        </div>
                        <div style="font-family: var(--font-display); font-size: 1.5rem; color: var(--text-primary); letter-spacing: 0.05em;">
                            @yhcgvv
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    const renderExerciseDetailView = (exerciseName) => {
        const exercise = currentWorkoutSession.exercises.find(ex => ex.name === exerciseName);
        if (!exercise) return `<p>Ошибка: упражнение не найдено.</p>`;

        const lastSet = exercise.performed_sets.length > 0 
            ? exercise.performed_sets[exercise.performed_sets.length - 1] 
            : { weight: '', reps: '' };

        let setsHTML = exercise.performed_sets.map((set, index) => `
            <div class="set-card">
                <span class="set-card-num">#${index + 1}</span>
                <button class="btn-delete-set-mini" name="delete-set" data-exercise-name="${exercise.name}" data-set-index="${index}"><i class='bx bx-x'></i></button>
                <div class="set-card-val">${parseInt(set.weight) === 0 ? formatWeightDisplay(0) : set.weight + ' <span style="font-size: 0.5em; text-transform: uppercase;">КГ</span>'}</div>
                <div class="set-card-meta">${set.reps} повт.</div>
            </div>
        `).join('');

        return `
        <div class="exercise-detail-view">
            <!-- Кнопка Назад -->
            <a href="#" id="back-to-workout-btn" style="display: inline-flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); text-decoration: none; font-weight: 700; margin-bottom: 2rem;">
                <i class='bx bx-left-arrow-alt' style="font-size: 1.5rem;"></i> Назад к списку
            </a>

            <!-- Заголовок -->
            <div class="exercise-hero">
                <h2>${exercise.name}</h2>
                <div class="rank-badge"><i class='bx bx-target-lock'></i> Цель: ${exercise.planned_target}</div>
            </div>

            <!-- Сетка подходов -->
            <h4 class="section-title">История подходов</h4>
            ${setsHTML.length > 0 ? `<div class="sets-grid">${setsHTML}</div>` : `<div style="padding: 2rem; text-align: center; border: 1px dashed var(--border-color); border-radius: 16px; color: var(--text-secondary); margin-bottom: 2rem;">Пока нет выполненных подходов</div>`}

            <h4 class="section-title" style="margin-top: 2rem;">Новый подход</h4>
            <form class="add-set-form-modern" id="add-set-form" data-exercise-name="${exercise.name}">
                <div class="big-input-grid">
                    
                    <!-- Колонка Вес -->
                    <div class="big-input-wrapper">
                        <label>Вес (кг)</label>
                        <!-- Кнопка сама встанет в правый угол благодаря CSS -->
                        <button type="button" id="btn-set-bodyweight" class="btn-bodyweight-toggle">
                            <i class='bx bx-body'></i> Свой вес
                        </button>
                        <input type="number" id="set-weight" class="big-input" value="${lastSet.weight}" placeholder="0">
                    </div>

                    <!-- Колонка Повторы -->
                    <div class="big-input-wrapper">
                        <label>Повторы</label>
                        <input type="number" id="set-reps" class="big-input" value="${lastSet.reps}" placeholder="0">
                    </div>
                </div>
                
                <button type="submit" class="btn btn-primary btn-big-add">
                    <i class='bx bx-plus'></i> Записать подход
                </button>
            </form>
        </div>`;
    };

    const modules = { home: renderHome, plan: renderPlan, library: renderLibrary, schedule: renderSchedule, profile: renderProfile, workout: renderWorkoutMode };
    const loadModule = async (moduleName) => {
        if (!checkAccess(moduleName)) {
            mainContent.innerHTML = renderSubscriptionWall(); 
            window.scrollTo(0, 0);
            return;
        }

        const renderFn = modules[moduleName];
        if (!renderFn) return;

        const html = await renderFn(); 
        
        
        if (html) {
            mainContent.innerHTML = html;
            window.scrollTo(0, 0);
        }

        
        if (moduleName === 'schedule') { 
            findAndSelectNextWorkoutDay(); 
        }
        if (moduleName === 'profile') { 
            renderProfileCharts(); 
        }
    };

    
    const formatTime = (seconds) => { const m = Math.floor(seconds / 60).toString().padStart(2, '0'); const s = (seconds % 60).toString().padStart(2, '0'); return `${m}:${s}`; };
    const getWeeklyProgress = () => { const today = new Date(); const day = today.getDay() || 7; const monday = new Date(today); monday.setHours(0,0,0,0); monday.setDate(today.getDate() - day + 1); let count = 0; workoutHistory.forEach(w => { const wDate = new Date(w.date); if (wDate >= monday) count++; }); return count; };
    function getDayNameFromElement(element) { const date = new Date(element.dataset.date); return daysOfWeek[(date.getDay() + 6) % 7]; }
    function addDragAndDropListeners() {}
    function findAndSelectNextWorkoutDay() { showWorkoutForDate(new Date().toISOString()); }
    
    const getBroQuote = () => {
        const quotes = [
            "Кардио — это с испанского 'потеря мышц'. Не рискуй.",
            "Друзья не позволяют друзьям пропускать день ног. Но настоящие друзья вообще не спрашивают про ноги.",
            "Если штанга не гнется — ты просто разминаешься, бро.",
            "Жим лежа — это единственный международный язык, который понимают все альфа-самцы.",
            "Твой единственный соперник в зеркале. И он выглядит чертовски хорошо, но ты должен его пережать.",
            "Бицепс — это визитная карточка. А ноги... ну, кто их видит в джинсах?",
            "Анаболическое окно закрывается через 15 минут. Беги к шейкеру или всё зря.",
            "Нет такого понятия как 'слишком много предтрена'. Есть понятие 'сердце, помедленнее'.",
            "Пресс — это хорошо, но когда ты в куртке, всем плевать на твои кубики. Качай плечи.",
            "Боль — это слабость, которая выходит из тела. Или грыжа. Но скорее всего первое.",
            "Любое упражнение — это упражнение на бицепс, если делать его с достаточным читингом.",
            "Твой рабочий вес — это чей-то рекорд. Помни об этом и гордись.",
            "Зал — это церковь, а силовая рама — алтарь. Не греши полуповторами.",
            "Разминка? Мой первый подход с рабочим весом — это и есть разминка.",
            "В любой непонятной ситуации делай памп. Кровь в мышцах — это жизнь.",
            "Если ты не кричишь на последнем повторе, значит ты мог сделать еще три.",
            "Магнезии много не бывает. Весь зал должен знать, что ты здесь был.",
            "Танки грязи не боятся, а качки не боятся калорий. Масса сама себя не наберет.",
            "Единственный раз, когда 'успех' идет перед 'работой' — это в словаре. И в рекламе протеина.",
            "Если после тренировки ты можешь подняться по лестнице, значит ты прогуливал подходы."
        ];
        return quotes[Math.floor(Math.random() * quotes.length)];
    };

    const getHoroscope = () => {
        const predictions = [
            "Звезды говорят: сегодня жимовая лавка будет свободна именно тогда, когда ты зайдешь в зал.",
            "Венера в коленях: старайся не встретиться взглядом с тренером по йоге, а то заставит растягиваться.",
            "Прогноз на вечер: твой предтреник подействует именно в тот момент, когда в зале заиграет твой любимый трек.",
            "Осторожно: сегодня в зале будет группа школьников по 10 человек на один тренажер. Иди на свободные веса.",
            "Удача на твоей стороне: ты найдешь вторую одинаковую гантелю с первого раза.",
            "Твой хват сегодня будет стальным. Идеальное время, чтобы потянуть новый максимум без лямок.",
            "Внимание: велика вероятность встретить старого знакомого, который захочет поболтать 40 минут между подходами.",
            "Биоритмы шепчут: сегодня твои чит-мил калории пойдут строго в мышцы, а не в живот.",
            "Знак судьбы: если на штанге остались блины от предыдущего атлета — это вызов. Подними их.",
            "Луна в трицепсе: твои руки будут казаться в зеркале больше на 2 см. Наслаждайся пампом.",
            "Пророчество: сегодня ты не забудешь помыть шейкер сразу после тренировки. Чудо возможно.",
            "Меркурий в ретрограде: не пытайся считать блины в уме, пересчитай дважды, а то повесишь лишнюю пятерку.",
            "Хорошие новости: твой плейлист сегодня не выдаст медляк в разгаре тяжелого сета.",
            "Совет дня: если предтреник заставляет тебя чесаться — значит, он работает. Не останавливайся.",
            "Сегодня идеальный день, чтобы надеть ту самую обтягивающую футболку. Форма на пике.",
            "Твой Ангел-Хранитель сегодня — дед, который жмет 140 с идеальной техникой. Присмотрись.",
            "Предупреждение: не делай становую в новых штанах, сегодня они под угрозой по шву.",
            "Гороскоп силы: сегодня гравитация будет на 5% слабее обычного. Пользуйся моментом.",
            "Твоя интуиция не подведет: тот парень на кроссовере реально заканчивает 'последний' подход уже полчаса.",
            "Итог дня: ты уйдешь из зала с чувством выполненного долга и диким голодом. Курица с рисом уже ждут."
        ];
        return predictions[Math.floor(Math.random() * predictions.length)];
    };
    
    
    function createExerciseHTML(name = '', sets = '', reps = '', weight = '') { return `<div class="exercise-entry"><input type="text" placeholder="Название" value="${name}" required><input type="number" placeholder="Подходы" value="${sets}" required><input type="text" placeholder="Повторы" value="${reps}" required><input type="text" placeholder="Вес" value="${weight}" required><button type="button" class="btn-delete-exercise">X</button></div>`; }
    function generateUniqueCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789'; let code = ''; for (let i = 0; i < 9; i++) { code += chars.charAt(Math.floor(Math.random() * chars.length)); } return `${code.slice(0,3)}-${code.slice(3,6)}-${code.slice(6,9)}`; }
    function copyToClipboard(text, button) { if (navigator.clipboard) { navigator.clipboard.writeText(text).then(() => { button.textContent = 'Скопировано!'; setTimeout(() => { button.textContent = 'Копировать'; }, 2000); }); } else { const textArea = document.createElement('textarea'); textArea.value = text; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); document.body.removeChild(textArea); button.textContent = 'Скопировано!'; setTimeout(() => { button.textContent = 'Копировать'; }, 2000); } }

    function openLibraryPlanModal(planIndex) {
        const plan = libraryPlans[planIndex];
        
        
        const iconClass = plan.icon || 'bx-dumbbell';
        
        const htmlContent = `
        <div class="lib-preview-container">
            <!-- HEADER -->
            <div class="lib-preview-hero">
                <div class="lib-preview-icon">
                    <i class='bx ${iconClass}'></i>
                </div>
                <div class="lib-preview-meta">
                    <h2 id="library-plan-title">${plan.name}</h2>
                    <div class="lib-preview-tags">
                        <span class="lib-p-tag">${plan.days || '? дней'}</span>
                        <span class="lib-p-tag">${plan.level || 'Общий'}</span>
                        <span class="lib-p-tag">${plan.type || 'Сила'}</span>
                    </div>
                </div>
            </div>
            
            <!-- ОПИСАНИЕ (если есть) -->
            <div style="color: var(--text-secondary); line-height: 1.5;">
                ${plan.description}
            </div>

            <!-- СЕТКА ДНЕЙ -->
            <div class="lib-days-grid" id="library-plan-details">
                ${generateDaysHTML(plan.schedule)}
            </div>
        </div>
        `;

       
        
        
        document.getElementById('library-plan-title').style.display = 'none';
        document.getElementById('library-plan-details').innerHTML = htmlContent;

        
        document.getElementById('add-library-plan-btn').dataset.libraryIndex = planIndex;
        
        document.getElementById('library-plan-modal').classList.add('visible');
    }

    function generateDaysHTML(schedule) {
        let html = '';
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
        
        let hasDays = false;

        days.forEach(day => {
            const exercises = schedule[day];
            if (exercises && exercises.length > 0) {
                hasDays = true;
                html += `
                <div class="lib-day-card">
                    <div class="lib-day-title">${day}</div>
                    <div class="lib-ex-list">
                        ${exercises.map(ex => `
                            <div class="lib-ex-item">
                                <span class="lib-ex-name">${ex.name}</span>
                                <span class="lib-ex-stats">${ex.sets} × ${ex.reps}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }
        });

        if (!hasDays) {
            return `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 2rem; border: 1px dashed var(--border-color); border-radius: 16px;">
                Нет расписания (свободный график)
            </div>`;
        }

        return html;
    }

    function openPlanModal(planIndex = null) {
        const modal = document.getElementById('plan-modal');
        const contentContainer = modal.querySelector('.modal-content');
        
        
        contentContainer.innerHTML = `
            <div class="plan-editor-header">
                <div class="plan-name-group">
                    <label style="color: var(--primary-color); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Project Name</label>
                    <input type="text" id="plan-name" class="plan-name-input" placeholder="Введите название..." autocomplete="off">
                </div>
            </div>

            <div class="day-tabs-wrapper" id="day-tabs"></div>
            <div id="days-container"></div>

            <div class="plan-editor-footer">
                <button type="button" class="btn" name="close-modal">Отмена</button>
                <button type="button" class="btn btn-primary" id="save-plan-btn">Сохранить</button>
            </div>
        `;

        const isNewPlan = planIndex === null;
        const plan = isNewPlan ? { name: '', schedule: {} } : trainingPlans[planIndex];
        document.getElementById('plan-name').value = plan.name;
        
        const tabsContainer = document.getElementById('day-tabs');
        const daysContainer = document.getElementById('days-container');

       
        const shortDays = {
            'Понедельник': 'ПН', 'Вторник': 'ВТ', 'Среда': 'СР',
            'Четверг': 'ЧТ', 'Пятница': 'ПТ', 'Суббота': 'СБ', 'Воскресенье': 'ВС'
        };

       
        daysOfWeek.forEach((day, index) => {
            const exercisesForDay = (plan.schedule && plan.schedule[day]) ? plan.schedule[day] : [];
            
           
            const tabBtn = document.createElement('div');
            tabBtn.className = `day-tab-tech ${index === 0 ? 'active' : ''}`;
            tabBtn.textContent = shortDays[day]; 
            
           
            tabBtn.dataset.dayFull = day; 
            
            tabBtn.onclick = () => switchTab(day);
            tabsContainer.appendChild(tabBtn);

          
            const contentPane = document.createElement('div');
            contentPane.className = `day-content-pane ${index === 0 ? 'active' : ''}`;
            contentPane.dataset.day = day;
            
            const exercisesHTML = exercisesForDay.map(ex => 
                createModernExerciseHTML(ex.name, ex.sets, ex.reps, ex.weight)
            ).join('');

            contentPane.innerHTML = `
                <div class="exercises-list">${exercisesHTML}</div>
                <button type="button" class="btn-add-tech" data-day="${day}">
                    <i class='bx bx-plus-circle'></i> Добавить упражнение
                </button>
            `;
            daysContainer.appendChild(contentPane);
        });

        document.getElementById('save-plan-btn').onclick = async () => {
            const name = document.getElementById('plan-name').value;
            if(!name) { showNotification('Введите название', 'error'); return; }
            
           
            const newSchedule = {};
            document.querySelectorAll('.day-content-pane').forEach(pane => {
                const day = pane.dataset.day;
                const exercises = [];
                pane.querySelectorAll('.editor-card-tech').forEach(card => {
                    const exName = card.querySelector('.inp-name').value;
                    const exSets = card.querySelector('.inp-sets').value;
                    const exReps = card.querySelector('.inp-reps').value;
                    const exWeight = card.querySelector('.inp-weight').value;
                    if(exName) exercises.push({ name: exName, sets: exSets, reps: exReps, weight: exWeight });
                });
                if(exercises.length > 0) newSchedule[day] = exercises;
            });

          
            const payload = {
                id: planIndex !== null ? trainingPlans[planIndex].id : null, 
                name: name,
                schedule: newSchedule
            };

            try {
                const response = await fetch('/api/plans/save/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken')},
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    showNotification('План успешно сохранен!');
                    document.getElementById('plan-modal').classList.remove('visible');
                    
               
                    await loadAllData(); 
                    loadModule('plan');
                }
            } catch (error) {
                showNotification('Ошибка сохранения плана', 'error');
            }
        };

        modal.classList.add('visible');
    }

  
    function switchTab(selectedDay) {
      
        document.querySelectorAll('.day-tab-tech').forEach(btn => {
           
            if (btn.dataset.dayFull === selectedDay) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
       
        document.querySelectorAll('.day-content-pane').forEach(pane => {
            if (pane.dataset.day === selectedDay) {
                pane.classList.add('active');
            } else {
                pane.classList.remove('active');
            }
        });
    }
    
    function openProfileModal() {
       
        document.getElementById('user-weight').value = userData.weight;
        
      
        const currentGender = userData.gender || 'Мужской';
        document.getElementById('user-gender').value = currentGender;

       
        document.querySelectorAll('.gender-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.value === currentGender) {
                btn.classList.add('active');
            }
        });

        document.getElementById('profile-modal').classList.add('visible');
    }
    function openPrsModal() { document.getElementById('user-squat').value = userData.prs.squat; document.getElementById('user-bench').value = userData.prs.bench; document.getElementById('user-deadlift').value = userData.prs.deadlift; document.getElementById('prs-modal').classList.add('visible'); }

    function renderProfileCharts() {
        const progressCtx = document.getElementById('progressChart');
        const measureCtx = document.getElementById('measurementsChart');

      
        if (progressCtx) {
            const progressCtx = progressCanvas.getContext('2d');
            if (progressChartInstance) progressChartInstance.destroy();

           
            const hasProgressData = userData.progress && userData.progress.labels && userData.progress.labels.length > 0;

           
            const progressLabels = hasProgressData ? userData.progress.labels : ['', '', '', '', ''];

            progressChartInstance = new Chart(progressCtx, {
                type: 'line',
                data: {
                    labels: progressLabels,
                    datasets: [
                        { 
                            label: 'Присед', 
                            data: hasProgressData ? userData.progress.squat : [], 
                            borderColor: '#F000B8', 
                            tension: 0.3,
                            pointRadius: hasProgressData ? 3 : 0 
                        },
                        { 
                            label: 'Жим', 
                            data: hasProgressData ? userData.progress.bench : [], 
                            borderColor: '#A855F7', 
                            tension: 0.3,
                            pointRadius: hasProgressData ? 3 : 0 
                        },
                        { 
                            label: 'Тяга', 
                            data: hasProgressData ? userData.progress.deadlift : [], 
                            borderColor: '#34D399', 
                            tension: 0.3,
                            pointRadius: hasProgressData ? 3 : 0 
                        }
                    ]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { 
                            display: hasProgressData, 
                            labels: { color: '#737373', font: { family: 'Inter' } } 
                        } 
                    },
                    scales: {
                        y: { 
                            beginAtZero: false,
                            min: hasProgressData ? undefined : 0,
                            max: hasProgressData ? undefined : 100,
                            ticks: { color: '#737373' }, 
                            grid: { color: '#262626' } 
                        },
                        x: { 
                            ticks: { color: '#737373' }, 
                            grid: { display: false } 
                        }
                    }
                }
            });
        }

        if (measureCtx) {
            const measureCtx = measureCanvas.getContext('2d');
            if (measureChartInstance) measureChartInstance.destroy();

            
            const hasData = userData.measurements && userData.measurements.length > 0;
            
            const labels = hasData 
                ? userData.measurements.map(m => m.date) 
                : ['', '', '', '', '']; 

            const datasets = [
                { label: 'Грудь', key: 'chest', color: '#F000B8' },
                { label: 'Талия', key: 'waist', color: '#A855F7' },
                { label: 'Бедра', key: 'hips', color: '#34D399' },
                { label: 'Бицепс', key: 'biceps', color: '#F97316' }
            ].map(item => ({
                label: item.label,
                data: hasData ? userData.measurements.map(m => m.measurements[item.key]) : [],
                borderColor: item.color,
                tension: 0.3,
                pointRadius: hasData ? 3 : 0, 
            }));

            measureChartInstance = new Chart(measureCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { 
                            display: hasData, 
                            labels: { color: '#737373', font: { family: 'Inter' } } 
                        } 
                    },
                    scales: {
                        y: { 
                            beginAtZero: false, 
                            min: hasData ? undefined : 0,
                            max: hasData ? undefined : 100,
                            ticks: { color: '#737373', stepSize: 20 }, 
                            grid: { color: '#262626' } 
                        },
                        x: { 
                            ticks: { color: '#737373' }, 
                            grid: { display: false } 
                        }
                    }
                }
            });
        }
    }

    const handleNavClick = async (e) => { e.preventDefault(); const target = e.currentTarget; const moduleName = target.dataset.module; if (moduleName) { navLinks.forEach(item => item.classList.toggle('active', item.dataset.module === moduleName)); await loadModule(moduleName); } if (mobileNavOverlay.classList.contains('open')) { mobileNavOverlay.classList.remove('open'); mobileNavToggle.innerHTML = `<i class='bx bx-menu'></i>`; } };

    navLinks.forEach(link => { link.addEventListener('click', handleNavClick); });
    logo.addEventListener('click', handleNavClick);
    mobileNavToggle.addEventListener('click', () => { const isOpen = mobileNavOverlay.classList.toggle('open'); mobileNavToggle.innerHTML = isOpen ? `<i class='bx bx-x'></i>` : `<i class='bx bx-menu'></i>`; });

    document.addEventListener('click', async (e) => {
        const target = e.target;

        if (target.closest('.btn-remove-ex')) {
            target.closest('.editor-exercise-card').remove();
        }

        if (target.id === 'discard-session-btn') {
            document.getElementById('session-conflict-modal').classList.add('visible');
        }
        if (target.id === 'continue-workout-btn') {
            loadModule('workout');
        }

        if (target.id === 'confirm-discard-session-btn') {
        currentWorkoutSession = null;
        localStorage.removeItem('currentWorkoutSession');
        
        document.getElementById('session-conflict-modal').classList.remove('visible');
        
        loadModule('home');
        
        showNotification('Старая сессия стерта', 'error');
    }

        if (e.target.closest('#btn-set-bodyweight')) {
            const input = document.getElementById('set-weight');
            if (input) {
                input.value = '0'; 
                
             
                input.style.backgroundColor = 'var(--primary-color)';
                input.style.color = '#000';
                setTimeout(() => {
                    input.style.backgroundColor = '';
                    input.style.color = '';
                }, 200);
            }
        }

      
        if (target.closest('.btn-tech-remove')) {
            target.closest('.editor-card-tech').remove();
        }
        
        
        if (target.closest('.btn-add-tech')) {
            const dayPane = target.closest('.day-content-pane');
            const list = dayPane.querySelector('.exercises-list');
            list.insertAdjacentHTML('beforeend', createModernExerciseHTML());
        }

        if (target.closest('#add-exercise-to-session-btn')) {
            document.getElementById('new-ex-name').value = '';
            document.getElementById('add-exercise-modal').classList.add('visible');
            setTimeout(() => document.getElementById('new-ex-name').focus(), 100);
        }
        
        if (target.closest('.btn-add-exercise-dashed')) {
            const dayPane = target.closest('.day-content-pane');
            const list = dayPane.querySelector('.exercises-list');
            list.insertAdjacentHTML('beforeend', createModernExerciseHTML());
        }
        if (target.closest('.calendar-date')) showWorkoutForDate(target.closest('.calendar-date').dataset.date);

        if (target.closest('.mood-btn')) {
            const btn = target.closest('.mood-btn');
            const mood = btn.dataset.mood;
            const widget = document.getElementById('mood-tracker-widget');
            const dateKey = widget.dataset.currentDateKey;

            await fetch('/api/daily/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    date: dateKey,
                    mood: mood
                })
            });

            if (!dailyStats[dateKey]) dailyStats[dateKey] = {};
            dailyStats[dateKey].mood = mood;
            updateMoodWidget(dateKey);
        }

        if (target.closest('.color-swatch')) {
            const newColor = target.closest('.color-swatch').dataset.color;

            try {
                const response = await fetch('/api/user/update/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' , 'X-CSRFToken': getCookie('csrftoken')},
                    body: JSON.stringify({
                        weight: userData.weight,
                        gender: userData.gender,
                        prs: userData.prs,
                        accentColor: newColor 
                    })
                });

                if (response.ok) {
                    
                    userData.accentColor = newColor;
                    applyThemeSettings();
                    
                    
                    document.querySelectorAll('.color-swatch').forEach(swatch => {
                        swatch.classList.toggle('active', swatch.dataset.color === newColor);
                    });
                }
            } catch (error) {
                console.error('Ошибка сохранения цвета:', error);
            }
        }

        if (target.id === 'confirm-delete-btn') {
            if (planToDeleteId !== null) { 
                try {
                    const response = await fetch(`/api/plans/delete/${planToDeleteId}/`);

                    if (response.ok) {
                        showNotification('План удален');
                        document.getElementById('delete-confirm-modal').classList.remove('visible');
                        
                        planToDeleteId = null; 
                        await loadAllData();   
                        loadModule('plan');   
                    }
                } catch (error) {
                    console.error('Ошибка удаления:', error);
                    showNotification('Ошибка связи с сервером', 'error');
                }
            } else {
                console.error("ID плана для удаления не найден!");
            }
        }

        if (target.closest('#timer-toggle')) { timerState.isRunning = !timerState.isRunning; if (timerState.isRunning) { timerState.interval = setInterval(() => { if (timerState.seconds > 0) { timerState.seconds--; const display = document.getElementById('timer-display'); if(display) display.textContent = formatTime(timerState.seconds); } else { timerState.isRunning = false; clearInterval(timerState.interval); showNotification('⏰ Время вышло!', 'success'); loadModule('home'); } }, 1000); } else { clearInterval(timerState.interval); } loadModule('home'); }
        if (target.closest('#timer-reset')) { timerState.isRunning = false; timerState.seconds = 0; clearInterval(timerState.interval); loadModule('home'); }
        if (target.closest('#timer-add-30')) { timerState.seconds += 30; const display = document.getElementById('timer-display'); if(display) display.textContent = formatTime(timerState.seconds); }
        if (target.closest('#timer-add-60')) { timerState.seconds += 60; const display = document.getElementById('timer-display'); if(display) display.textContent = formatTime(timerState.seconds); }

        if (target.closest('#calc-rm-btn')) {
            const w = parseFloat(document.getElementById('rm-weight-input').value);
            const r = parseInt(document.getElementById('rm-reps-input').value);
            
            if (w && r) {
                
                const rm = w * (1 + r / 30);
                
                
                const data = [
                    { p: 100, goal: 'Максимум (1)' },
                    { p: 95,  goal: 'Сила (2-3)' },
                    { p: 90,  goal: 'Сила (3-4)' },
                    { p: 85,  goal: 'Сила/Гипертрофия (5-6)' },
                    { p: 80,  goal: 'Гипертрофия (7-8)' },
                    { p: 75,  goal: 'Гипертрофия (9-11)' },
                    { p: 70,  goal: 'Гипертрофия/Выносливость (12-15)' },
                    { p: 60,  goal: 'Выносливость (15-20+)' }
                ];

                
                const rows = data.map(item => {
                    const weight = Math.round(rm * (item.p / 100));
                    return `
                    <tr>
                        <td class="rm-col-percent">${item.p}%</td>
                        <td class="rm-col-weight">${weight} кг</td>
                        <td class="rm-col-goal">${item.goal}</td>
                    </tr>`;
                }).join('');

                const html = `
                    <div class="rm-hero-display">
                        <div class="rm-hero-title">Ваш примерный 1ПМ:</div>
                        <div class="rm-hero-value">${rm.toFixed(1)} кг</div>
                        <div class="rm-hero-formula">(Формула: Epley)</div>
                    </div>
                    
                    <div class="rm-table-header">Рабочие веса для тренировок</div>
                    
                    <table class="rm-table">
                        <thead>
                            <tr>
                                <th>% от 1ПМ</th>
                                <th>Вес (кг)</th>
                                <th style="text-align: right;">Цель / Повторения</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>`;
                
                document.getElementById('rm-result-content').innerHTML = html;
                document.getElementById('rm-result-modal').classList.add('visible');
            } else {
                showNotification('Введите вес и повторения!', 'error');
            }
        }

        if (target.closest('#start-workout-btn')) {
            const dayName = daysOfWeek[(new Date().getDay() + 6) % 7];
            const activePlan = trainingPlans.find(p => p.active);
            const todayWorkoutPlan = activePlan?.schedule?.[dayName] ?? [];

            currentWorkoutSession = {
                date: new Date().toISOString(),
                planName: activePlan ? activePlan.name : "Свободная",
                exercises: todayWorkoutPlan.map(ex => ({
                    name: ex.name,
                    planned_target: `${ex.sets}x${ex.reps} · ${ex.weight} кг`,
                    performed_sets: []
                }))
            };

           
            localStorage.setItem('currentWorkoutSession', JSON.stringify(currentWorkoutSession));
            
            loadModule('workout');
            navLinks.forEach(item => item.classList.toggle('active', item.dataset.module === 'workout'));
        }

        if (target.closest('[data-module="workout"]')) { loadModule('workout'); }
        if (target.closest('#end-workout-btn')) {
            
            showVictoryScreen();
        }
        if (target.closest('.workout-exercise-summary-card')) { mainContent.innerHTML = renderExerciseDetailView(target.closest('.workout-exercise-summary-card').dataset.exerciseName); }
        if (target.closest('#back-to-workout-btn')) { e.preventDefault(); renderWorkoutMode(); }
        const deleteSetBtn = target.closest('button[name="delete-set"]'); 
        if (deleteSetBtn) { 
            const exerciseName = deleteSetBtn.dataset.exerciseName; 
            const setIndex = parseInt(deleteSetBtn.dataset.setIndex, 10); 
            const exercise = currentWorkoutSession.exercises.find(ex => ex.name === exerciseName); 
            if (exercise) { 
                exercise.performed_sets.splice(setIndex, 1); 
                localStorage.setItem('currentWorkoutSession', JSON.stringify(currentWorkoutSession));
                saveAllData(); 
                mainContent.innerHTML = renderExerciseDetailView(exerciseName); 
            } 
        }

        if (target.matches('#save-note-btn')) {
            const dateKey = target.dataset.dateKey;
            const noteText = document.getElementById('note-textarea').value;

            await fetch('/api/daily/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' , 'X-CSRFToken': getCookie('csrftoken')},
                body: JSON.stringify({
                    date: dateKey,
                    note: noteText
                })
            });
            
            scheduleNotes[dateKey] = noteText;
            showNotification('Заметка успешно сохранена');
        }

        if (target.matches('[name="close-modal"]')) { target.closest('.modal-backdrop').classList.remove('visible'); }
        if (target.closest('#import-plan-btn')) { document.getElementById('import-modal').classList.add('visible'); }
        if (target.closest('#create-plan-btn')) { openPlanModal(); }
        if (target.closest('button[name="edit-plan"]')) { openPlanModal(target.closest('button').dataset.planIndex); }
        if (target.closest('button[name="add-exercise"]')) { const dayEditor = target.closest('.modal-day-editor'); dayEditor.querySelector('.exercises-list').insertAdjacentHTML('beforeend', createExerciseHTML()); }
        if (target.closest('.btn-delete-exercise')) { target.closest('.exercise-entry').remove(); }

        if (target.closest('button[name="export-plan"]')) {
            const planIndex = target.closest('button').dataset.planIndex;
            const plan = trainingPlans[planIndex];

            const response = await fetch('/api/plans/export/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    name: plan.name,
                    schedule: plan.schedule
                })
            });

            const result = await response.json();
            if (result.code) {
                document.getElementById('export-code').value = result.code;
                document.getElementById('export-modal').classList.add('visible');
            }
        }

        if (target.closest('button[name="activate-plan"]')) {
            const planIndex = target.closest('button').dataset.planIndex;
            const planId = trainingPlans[planIndex].id;

            const response = await fetch(`/api/plans/activate/${planId}/`);
            if (response.ok) {
                showNotification('План активирован!');
                await loadAllData();
                loadModule('plan');
            }
        }

        if (target.closest('button[name="delete-plan"]')) {
            const planIndex = target.closest('button').dataset.planIndex;
            
            planToDeleteId = trainingPlans[planIndex].id; 
            document.getElementById('delete-confirm-modal').classList.add('visible');
        }

        const libCard = target.closest('.lib-card-cyber');
        
        if (libCard) {
            
            const index = parseInt(libCard.dataset.libraryIndex);
            
            openLibraryPlanModal(index);
        }

        if (target.closest('#edit-profile-btn')) { document.getElementById('user-weight').value = userData.weight; document.getElementById('user-gender').value = userData.gender; document.getElementById('profile-modal').classList.add('visible'); }
        if (target.closest('#edit-prs-btn')) { document.getElementById('user-squat').value = userData.prs.squat; document.getElementById('user-bench').value = userData.prs.bench; document.getElementById('user-deadlift').value = userData.prs.deadlift; document.getElementById('prs-modal').classList.add('visible'); }
        if (target.closest('#add-measurement-btn')) { document.getElementById('measurement-modal').classList.add('visible'); }
        if (target.closest('.gender-option')) {
            const btn = target.closest('.gender-option');
            const parent = btn.closest('.gender-selector');
            
            
            parent.querySelectorAll('.gender-option').forEach(b => b.classList.remove('active'));
            
           
            btn.classList.add('active');
            
          
            document.getElementById('user-gender').value = btn.dataset.value;
        }

     
        if (target.closest('#prev-month-btn')) {
    
            currentScheduleDate = new Date(currentScheduleDate.getFullYear(), currentScheduleDate.getMonth() - 1, 1);
            loadModule('schedule');
        }

        if (target.closest('#next-month-btn')) {
            currentScheduleDate = new Date(currentScheduleDate.getFullYear(), currentScheduleDate.getMonth() + 1, 1);
            loadModule('schedule');
        }

        const addSetBtn = e.target.closest('.btn-big-add');

        if (addSetBtn) {
            e.preventDefault(); 
            
            const form = addSetBtn.closest('form');
            if (!form) return;

            const exerciseName = form.dataset.exerciseName;

            const weightInput = document.getElementById('set-weight');
            const repsInput = document.getElementById('set-reps');

            if (weightInput && repsInput) {
                const weight = weightInput.value.trim();
                const reps = repsInput.value.trim();

                if (weight && reps) {
                    const exercise = currentWorkoutSession.exercises.find(ex => ex.name === exerciseName);
                    
                    if (exercise) {
                        
                        exercise.performed_sets.push({ weight, reps });
                        localStorage.setItem('currentWorkoutSession', JSON.stringify(currentWorkoutSession));
                        saveAllData();

                        
                        mainContent.innerHTML = renderExerciseDetailView(exerciseName);
                        
                        
                        setTimeout(() => {
                            const nextRepInput = document.getElementById('set-reps');
                            if(nextRepInput) nextRepInput.focus();
                        }, 50);
                    }
                } else {
                    showNotification('Введите вес и повторения', 'error');
                }
            }
        }
        const card = e.target.closest('.workout-card-modern');
        
        if (card) {
            
            const exerciseName = card.dataset.exerciseName;
            
            
            if (exerciseName) {
                mainContent.innerHTML = renderExerciseDetailView(exerciseName);
            }
        }
    });

    const newExForm = document.getElementById('new-exercise-form');
    if (newExForm) {
        newExForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const nameInput = document.getElementById('new-ex-name');
            const newName = nameInput.value.trim();

            if (newName && currentWorkoutSession) {
                
                currentWorkoutSession.exercises.push({
                    name: newName,
                    planned_target: "Добавлено вручную",
                    performed_sets: []
                });
                
                saveAllData();
                
                document.getElementById('add-exercise-modal').classList.remove('visible');
                
                renderWorkoutMode(); 
            }
        });
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (planToDeleteIndex !== null) {
              
                trainingPlans.splice(planToDeleteIndex, 1);
                
            
                saveAllData();
                loadModule('plan');
                
             
                document.getElementById('delete-confirm-modal').classList.remove('visible');
                planToDeleteIndex = null;
            }
        });
    }

    document.getElementById('plan-form').addEventListener('submit', (e) => { e.preventDefault(); const planId = document.getElementById('plan-id').value; const newPlan = { name: document.getElementById('plan-name').value, active: false, schedule: {} }; document.querySelectorAll('.modal-day-editor').forEach(dayEditor => { const day = dayEditor.querySelector('h4').textContent; const exercises = []; dayEditor.querySelectorAll('.exercise-entry').forEach(entry => { const inputs = entry.querySelectorAll('input'); exercises.push({ name: inputs[0].value, sets: inputs[1].value, reps: inputs[2].value, weight: inputs[3].value }); }); if (exercises.length > 0) newPlan.schedule[day] = exercises; }); if (planId !== '') { newPlan.active = trainingPlans[planId].active; trainingPlans[planId] = newPlan; } else { if (trainingPlans.length === 0) newPlan.active = true; trainingPlans.push(newPlan); } saveAllData(); document.getElementById('plan-modal').classList.remove('visible'); loadModule('plan'); });

    document.getElementById('import-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('import-code').value;

        const response = await fetch('/api/plans/import/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
            body: JSON.stringify({ code: code })
        });

        const result = await response.json();
        if (result.status === 'success') {
           
            const saveResponse = await fetch('/api/plans/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    name: result.name + " (Импорт)",
                    schedule: result.schedule
                })
            });

            if (saveResponse.ok) {
                showNotification('План успешно импортирован!');
                document.getElementById('import-modal').classList.remove('visible');
                await loadAllData();
                loadModule('plan');
            }
        } else {
            showNotification(result.message, 'error');
        }
    });

    document.getElementById('copy-code-btn').addEventListener('click', (e) => { const textToCopy = document.getElementById('export-code').value; copyToClipboard(textToCopy, e.target); });

    document.getElementById('add-library-plan-btn').addEventListener('click', async (e) => {
        const planIndex = e.target.dataset.libraryIndex;
        const planToAdd = libraryPlans[planIndex];

        if (!planToAdd) {
            showNotification('Ошибка: план не найден', 'error');
            return;
        }

    
        const payload = {
            id: null, 
            name: planToAdd.name,
            schedule: planToAdd.schedule
        };

        try {
            const response = await fetch('/api/plans/save/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showNotification(`План "${planToAdd.name}" добавлен!`);
                
           
                document.getElementById('library-plan-modal').classList.remove('visible');
                
          
                await loadAllData(); 
                
              
                loadModule('plan'); 
                navLinks.forEach(item => item.classList.toggle('active', item.dataset.module === 'plan'));
            }
        } catch (error) {
            console.error('Ошибка при добавлении плана:', error);
            showNotification('Ошибка при сохранении плана', 'error');
        }
    });

    function showVictoryScreen() {
        if (!currentWorkoutSession) return;

      
        let totalVol = 0;
        let totalSets = 0;
        let totalReps = 0;

        currentWorkoutSession.exercises.forEach(ex => {
            ex.performed_sets.forEach(s => {
                totalVol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
                totalSets++;
                totalReps += parseInt(s.reps) || 0;
            });
        });

       
        const overlay = document.createElement('div');
        overlay.className = 'victory-overlay';
        overlay.innerHTML = `
            <div class="victory-title">SESSION<br>COMPLETE</div>
            
            <div class="victory-stats-grid">
                <div class="v-stat-card">
                    <div class="v-stat-val">${(totalVol / 1000).toFixed(1)}т</div>
                    <div class="v-stat-label">Тоннаж</div>
                </div>
                <div class="v-stat-card">
                    <div class="v-stat-val">${totalSets}</div>
                    <div class="v-stat-label">Подходы</div>
                </div>
                <div class="v-stat-card">
                    <div class="v-stat-val">${totalReps}</div>
                    <div class="v-stat-label">Повторы</div>
                </div>
                <div class="v-stat-card">
                    <div class="v-stat-val">Done</div>
                    <div class="v-stat-label">Статус</div>
                </div>
            </div>

            <button id="victory-close-btn" class="btn btn-primary" style="padding: 1rem 3rem; font-size: 1.2rem;">
                СОХРАНИТЬ И ВЫЙТИ
            </button>
        `;

        document.body.appendChild(overlay);

      
        document.getElementById('victory-close-btn').onclick = async () => {
           
            let totalVol = 0;
            currentWorkoutSession.exercises.forEach(ex => {
                ex.performed_sets.forEach(s => {
                    totalVol += (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0);
                });
            });

            
            const payload = {
                planName: currentWorkoutSession.planName,
                exercises: currentWorkoutSession.exercises,
                totalVolume: totalVol
            };

            try {
                const response = await fetch('/api/workout/save/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    currentWorkoutSession = null;
                    localStorage.removeItem('currentWorkoutSession');  
                    
                   
                    document.querySelector('.victory-overlay').remove();
                    await loadAllData(); 
                    loadModule('home');
                }
            } catch (error) {
                console.error('Ошибка сохранения тренировки:', error);
                showNotification('Ошибка сохранения', 'error');
            }
        };
    }

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
       
        const newWeight = parseFloat(document.getElementById('user-weight').value);
        const newGender = document.getElementById('user-gender').value;

    
        try {
            const response = await fetch('/api/user/update/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify({
                    weight: newWeight,
                    gender: newGender,
                    prs: userData.prs, 
                    accentColor: userData.accentColor
                })
            });

            if (response.ok) {
              
                userData.weight = newWeight;
                userData.gender = newGender;
                
                document.getElementById('profile-modal').classList.remove('visible');
                loadModule('profile');
            }
        } catch (error) {
            showNotification('Ошибка при связи с сервером', 'error');
        }
    });
    
    const prsForm = document.getElementById('prs-form');
    if (prsForm) {
        prsForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPrs = {
                squat: parseInt(document.getElementById('user-squat').value) || 0,
                bench: parseInt(document.getElementById('user-bench').value) || 0,
                deadlift: parseInt(document.getElementById('user-deadlift').value) || 0
            };

            try {
                const response = await fetch('/api/user/update/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                    body: JSON.stringify({
                        weight: userData.weight,
                        gender: userData.gender,
                        prs: newPrs,
                        accentColor: userData.accentColor
                    })
                });

                if (response.ok) {
                    
                    await loadAllData();
                    
                    document.getElementById('prs-modal').classList.remove('visible');
                    
                    loadModule('profile'); 
                }
            } catch (error) {
                console.error('Ошибка:', error);
                showNotification('Ошибка сохранения рекордов', 'error');
            }
        });
    }

    const measForm = document.getElementById('measurement-form');
    if (measForm) {
        measForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                weight: userData.weight, 
                chest: parseFloat(document.getElementById('meas-chest').value) || 0,
                waist: parseFloat(document.getElementById('meas-waist').value) || 0,
                hips: parseFloat(document.getElementById('meas-hips').value) || 0,
                biceps: parseFloat(document.getElementById('meas-biceps').value) || 0
            };

            const response = await fetch('/api/user/measurements/add/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                document.getElementById('measurement-modal').classList.remove('visible');
                await loadAllData(); 
                loadModule('profile');
            }
        });
    }


    loadAllData();
    if (currentWorkoutSession) { loadModule('home'); } else { loadModule('home'); }
});