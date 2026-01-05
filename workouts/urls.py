from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/user/', views.get_user_data, name='api_user'),
    path('api/user/update/', views.update_user_data, name='api_user_update'),
    path('api/user/measurements/add/', views.add_measurement, name='api_add_measurement'),
    path('api/plans/', views.get_plans, name='api_plans'),
    path('api/plans/export/', views.export_plan_api, name='api_export_plan'),
    path('api/plans/import/', views.import_plan_api, name='api_import_plan'),
    path('api/plans/save/', views.save_plan, name='api_save_plan'),
    path('api/plans/activate/<int:plan_id>/', views.activate_plan, name='api_activate_plan'),
    path('api/plans/delete/<int:plan_id>/', views.delete_plan, name='api_delete_plan'),
    path('api/workout/save/', views.save_workout_session, name='api_save_workout'),
    path('api/daily/save/', views.save_daily_entry, name='api_save_daily'),
    path('api/library/', views.get_library, name='api_library'),
]