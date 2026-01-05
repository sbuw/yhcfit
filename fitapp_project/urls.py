from django.contrib import admin
from django.urls import path, include
from workouts import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('django.contrib.auth.urls')), # Вход, выход, смена пароля
    path('accounts/register/', views.register, name='register'), # Наша регистрация
    path('', include('workouts.urls')), # Подключаем маршруты приложения
]