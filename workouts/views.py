from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from .models import TrainingPlan, UserProfile, BodyMeasurement, PowerliftingProgress, WorkoutHistory, DailyEntry, LibraryPlan, SharedPlan
import json
import random, string
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.shortcuts import redirect
from django.contrib.auth import login

@login_required
def index(request):
    return render(request, 'index.html')

def register(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user) # Сразу логиним после регистрации
            return redirect('index')
    else:
        form = UserCreationForm()
    return render(request, 'registration/register.html', {'form': form})


# 1. ПОЛУЧЕНИЕ ДАННЫХ (включая историю для графиков)
@login_required
def get_user_data(request):
    user = request.user
    profile = user.profile
    
    # Получаем все исторические данные из БД
    pl_history = PowerliftingProgress.objects.filter(user=user).order_by('date')
    measure_history = BodyMeasurement.objects.filter(user=user).order_by('date')
    full_history = WorkoutHistory.objects.filter(user=user).order_by('-date')
    daily_entries = DailyEntry.objects.filter(user=user)

    data = {
        'username': user.username,
        'weight': profile.weight,
        'gender': profile.gender,
        'prs': {
            'squat': profile.squat_pr,
            'bench': profile.bench_pr,
            'deadlift': profile.deadlift_pr,
        },
        'accentColor': profile.accent_color,
        
        # Данные для графика силовых (SBD)
        'progress': {
            'labels': [h.date.strftime('%d.%m') for h in pl_history],
            'squat': [h.squat for h in pl_history],
            'bench': [h.bench for h in pl_history],
            'deadlift': [h.deadlift for h in pl_history],
        },
        
        # Исправленный блок замеров (теперь без ошибок)
        'measurements': [
            {
                'date': m.date.strftime('%d.%m'),
                'measurements': {
                    'chest': m.chest, 
                    'waist': m.waist, 
                    'hips': m.hips, 
                    'biceps': m.biceps
                },
                'weight': m.weight
            } for m in measure_history
        ],
        
        # История тренировок для календаря и ленты
        'workoutHistory': [
            {
                'date': h.date.isoformat(),
                'planName': h.plan_name,
                'exercises': h.session_data,
                'totalVolume': h.total_volume
            } for h in full_history
        ],
        
        # Заметки и настроение
        'dailyEntries': {
            entry.date.isoformat(): {
                'mood': entry.mood, 
                'note': entry.note
            } for entry in daily_entries
        },
        'subscription_end': profile.subscription_end.isoformat() if profile.subscription_end else None,
        'is_subscribed': profile.is_subscribed,
    }
    return JsonResponse(data)

# 2. СОХРАНЕНИЕ ПРОФИЛЯ И РЕКОРДОВ (с записью в историю)

@login_required
def update_user_data(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = request.user
        profile = user.profile
        
        # 1. Запоминаем СТАРЫЕ веса перед обновлением
        old_squat = profile.squat_pr
        old_bench = profile.bench_pr
        old_deadlift = profile.deadlift_pr
        
        # 2. Получаем НОВЫЕ веса из запроса
        prs = data.get('prs', {})
        new_squat = int(prs.get('squat', old_squat))
        new_bench = int(prs.get('bench', old_bench))
        new_deadlift = int(prs.get('deadlift', old_deadlift))

        # 3. Обновляем основные поля профиля
        profile.weight = data.get('weight', profile.weight)
        profile.gender = data.get('gender', profile.gender)
        profile.accent_color = data.get('accentColor', profile.accent_color)
        
        # Обновляем рекорды в профиле
        profile.squat_pr = new_squat
        profile.bench_pr = new_bench
        profile.deadlift_pr = new_deadlift
        profile.save()

        # 4. ПРОВЕРКА: Если хотя бы один вес изменился — пишем в историю
        if new_squat != old_squat or new_bench != old_bench or new_deadlift != old_deadlift:
            PowerliftingProgress.objects.create(
                user=user,
                squat=new_squat,
                bench=new_bench,
                deadlift=new_deadlift
            )
            print("Силовые изменились: создана точка на графике")
        else:
            print("Силовые не менялись: запись в историю пропущена")
        
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)

# 3. ДОБАВЛЕНИЕ ЗАМЕРОВ ТЕЛА

@login_required
def add_measurement(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = request.user
        
        # Создаем запись в истории замеров
        BodyMeasurement.objects.create(
            user=user,
            weight=data.get('weight', 0),
            chest=data.get('chest', 0),
            waist=data.get('waist', 0),
            hips=data.get('hips', 0),
            biceps=data.get('biceps', 0)
        )
        
        # Обновим текущий вес и в профиле
        profile = user.profile
        profile.weight = data.get('weight', profile.weight)
        profile.save()
        
        return JsonResponse({'status': 'success'})
    return JsonResponse({'status': 'error'}, status=400)

# 4. ПОЛУЧЕНИЕ ПЛАНОВ
@login_required
def get_plans(request):
    plans = TrainingPlan.objects.filter(user=request.user)
    plans_list = [{
        'id': p.id,
        'name': p.name,
        'active': p.is_active,
        'schedule': p.schedule
    } for p in plans]
    return JsonResponse(plans_list, safe=False)


@login_required
def save_plan(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        plan_id = data.get('id')
        
        if plan_id:
            # Важно: ищем план именно этого пользователя
            plan = TrainingPlan.objects.get(id=plan_id, user=request.user)
            plan.name = data.get('name')
            plan.schedule = data.get('schedule')
            plan.save()
        else:
            # Создаем новый план для текущего юзера
            TrainingPlan.objects.create(
                user=request.user,
                name=data.get('name'),
                schedule=data.get('schedule'),
                is_active=False
            )
        return JsonResponse({'status': 'success'})
    

@login_required
def activate_plan(request, plan_id):
    """Сделать план активным, а остальные — выключить"""
    user = request.user
    # Выключаем все
    TrainingPlan.objects.filter(user=user).update(is_active=False)
    # Включаем выбранный
    TrainingPlan.objects.filter(id=plan_id, user=user).update(is_active=True)
    return JsonResponse({'status': 'success'})


@login_required
def delete_plan(request, plan_id):
    """Удалить план"""
    user = request.user
    TrainingPlan.objects.filter(id=plan_id, user=user).delete()
    return JsonResponse({'status': 'success'})


@login_required
def save_workout_session(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user = request.user
            
            # Создаем запись в истории тренировок
            history_entry = WorkoutHistory.objects.create(
                user=user,
                plan_name=data.get('planName', 'Свободная тренировка'),
                session_data=data.get('exercises', []), # Массив упражнений с подходами
                total_volume=data.get('totalVolume', 0)
            )
            
            return JsonResponse({
                'status': 'success', 
                'session_id': history_entry.id
            })
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
            
    return JsonResponse({'status': 'error', 'message': 'Only POST allowed'}, status=400)


@login_required
def save_daily_entry(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = request.user
        date_str = data.get('date') # Ожидаем YYYY-MM-DD
        
        entry, created = DailyEntry.objects.get_or_create(
            user=user, 
            date=date_str
        )
        entry.mood = data.get('mood', entry.mood)
        entry.note = data.get('note', entry.note)
        entry.save()
        
        return JsonResponse({'status': 'success'})

@login_required
def get_library(request):
    plans = LibraryPlan.objects.all()
    data = [{
        'name': p.name,
        'description': p.description,
        'icon': p.icon,
        'type': p.plan_type,
        'days': p.days,
        'level': p.level,
        'schedule': p.schedule
    } for p in plans]
    return JsonResponse(data, safe=False)

# 2. Экспорт (создание кода)

@login_required
def export_plan_api(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        # Генерируем код типа XXX-XXX-XXX
        code = '-'.join([''.join(random.choices(string.ascii_uppercase + string.digits, k=3)) for _ in range(3)])
        
        SharedPlan.objects.create(
            code=code,
            name=data.get('name'),
            schedule=data.get('schedule')
        )
        return JsonResponse({'code': code})

# 3. Импорт (поиск по коду)

@login_required
def import_plan_api(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        code = data.get('code', '').upper()
        
        try:
            shared = SharedPlan.objects.get(code=code)
            # Возвращаем данные плана, чтобы JS сохранил его как новый план юзера
            return JsonResponse({
                'status': 'success',
                'name': shared.name,
                'schedule': shared.schedule
            })
        except SharedPlan.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Код не найден'}, status=404)