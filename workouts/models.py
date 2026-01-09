from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from django.utils import timezone
from datetime import timedelta

import uuid

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        trial_end = timezone.now().date() + timedelta(days=14)
        UserProfile.objects.create(user=instance, subscription_end=trial_end)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()

class UserProfile(models.Model):
    """Дополнительные данные пользователя (вес, пол, рекорды)"""
    GENDER_CHOICES = [
        ('M', 'Мужской'),
        ('W', 'Женский'),
    ]
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    weight = models.FloatField(default=0.0)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    
    squat_pr = models.IntegerField(default=0)
    bench_pr = models.IntegerField(default=0)
    deadlift_pr = models.IntegerField(default=0)
    
    accent_color = models.CharField(max_length=20, default='#F000B8')

    subscription_end = models.DateField(null=True, blank=True)

    @property
    def is_subscribed(self):
        from django.utils import timezone
        if self.subscription_end:
            return self.subscription_end >= timezone.now().date()
        return False

    def __str__(self):
        return f"Профиль: {self.user.username}"

class TrainingPlan(models.Model):
    """Тренировочные планы (структура тренировок)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='plans')
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=False)
    
    schedule = models.JSONField(default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.user.username})"

class WorkoutHistory(models.Model):
    """История завершенных тренировок (Дневник)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='history')
    date = models.DateTimeField(auto_now_add=True)
    plan_name = models.CharField(max_length=100)
    
    session_data = models.JSONField(default=list)
    
    total_volume = models.FloatField(default=0)

    def __str__(self):
        return f"{self.plan_name} - {self.date.strftime('%d.%m.%Y')}"
    
class BodyMeasurement(models.Model):
    """История замеров тела"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='measurements')
    date = models.DateField(auto_now_add=True)
    weight = models.FloatField()
    chest = models.FloatField(default=0)
    waist = models.FloatField(default=0)
    hips = models.FloatField(default=0)
    biceps = models.FloatField(default=0)

    def __str__(self):
        return f"Замеры {self.user.username} - {self.date}"

class PowerliftingProgress(models.Model):
    """История силового прогресса (для графиков)"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pl_progress')
    date = models.DateField(auto_now_add=True)
    squat = models.IntegerField()
    bench = models.IntegerField()
    deadlift = models.IntegerField()

    def __str__(self):
        return f"SBD Прогресс {self.user.username} - {self.date}"
    
class DailyEntry(models.Model):
    """Заметки и настроение на конкретную дату"""
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField()
    mood = models.CharField(max_length=20, blank=True, null=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('user', 'date')

    def __str__(self):
        return f"{self.date} - {self.user.username}"

class LibraryPlan(models.Model):
    """Готовые программы от разработчиков"""
    name = models.CharField(max_length=100)
    description = models.TextField()
    icon = models.CharField(max_length=50, default='bx-dumbbell')
    plan_type = models.CharField(max_length=50, default='Силовой')
    days = models.CharField(max_length=20, default='3 дня')
    level = models.CharField(max_length=20, default='Новичок')
    schedule = models.JSONField()

    def __str__(self):
        return self.name

class SharedPlan(models.Model):
    """Планы, которыми поделились пользователи"""
    code = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=100)
    schedule = models.JSONField()

    def __str__(self):
        return f"{self.code} - {self.name}"