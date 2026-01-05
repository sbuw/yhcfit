from django.contrib import admin
from .models import UserProfile, TrainingPlan, WorkoutHistory, LibraryPlan, SharedPlan, PowerliftingProgress, BodyMeasurement

admin.site.register(UserProfile)
admin.site.register(TrainingPlan)
admin.site.register(WorkoutHistory)
admin.site.register(LibraryPlan)
admin.site.register(SharedPlan)
admin.site.register(PowerliftingProgress)
admin.site.register(BodyMeasurement)